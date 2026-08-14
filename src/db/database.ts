/**
 * 数据库驱动抽象层。
 *
 * - 原生（iOS/Android）：@capacitor-community/sqlite，真正的设备 SQLite 文件。
 * - Web 预览：sql.js（SQLite 编译为 WASM），导出字节经 base64 持久化到
 *   localStorage。两端跑同一份 SQL、同一份 schema 与迁移脚本。
 *
 * 业务数据不直接写 localStorage —— Web 端 localStorage 仅作为
 * SQLite 数据库文件的持久化介质。
 */
import { Capacitor } from '@capacitor/core'
import { runMigrations } from './schema'

export interface DbDriver {
  run(sql: string, params?: unknown[]): Promise<void>
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  /** 执行多语句 DDL（无参数） */
  executeBatch(sql: string): Promise<void>
}

const DB_NAME = 'masterpiece.db'
const WEB_STORE_KEY = 'masterpiece.sqlite.b64'

let driver: DbDriver | null = null
let txDepth = 0

/* ---------------- Web: sql.js 驱动 ---------------- */

async function createWebDriver(): Promise<DbDriver> {
  const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([
    import('sql.js'),
    import('sql.js/dist/sql-wasm.wasm?url'),
  ])
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })

  let db: InstanceType<typeof SQL.Database>
  const saved = localStorage.getItem(WEB_STORE_KEY)
  if (saved) {
    const bin = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0))
    db = new SQL.Database(bin)
  } else {
    db = new SQL.Database()
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleSave = () => {
    if (txDepth > 0) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const bytes = db.export()
      let bin = ''
      const chunk = 0x8000
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
      }
      localStorage.setItem(WEB_STORE_KEY, btoa(bin))
    }, 250)
  }

  return {
    async run(sql, params = []) {
      db.run(sql, params as (string | number | null | Uint8Array)[])
      scheduleSave()
    },
    async query<T>(sql: string, params = []) {
      const stmt = db.prepare(sql)
      try {
        stmt.bind(params as (string | number | null)[])
        const rows: T[] = []
        while (stmt.step()) rows.push(stmt.getAsObject() as T)
        return rows
      } finally {
        stmt.free()
      }
    },
    async executeBatch(sql) {
      db.exec(sql)
      scheduleSave()
    },
  }
}

/* ---------------- 原生: @capacitor-community/sqlite ---------------- */

async function createNativeDriver(): Promise<DbDriver> {
  const { CapacitorSQLite, SQLiteConnection } = await import(
    '@capacitor-community/sqlite'
  )
  const sqlite = new SQLiteConnection(CapacitorSQLite)
  const consistency = await sqlite.checkConnectionsConsistency()
  const hasConn = (await sqlite.isConnection(DB_NAME, false)).result
  if (consistency.result && hasConn) {
    await sqlite.closeConnection(DB_NAME, false)
  }
  const conn = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
  await conn.open()

  return {
    async run(sql, params = []) {
      await conn.run(sql, params)
    },
    async query<T>(sql: string, params = []) {
      const res = await conn.query(sql, params)
      return (res.values ?? []) as T[]
    },
    async executeBatch(sql) {
      await conn.execute(sql)
    },
  }
}

/* ---------------- 公共 API ---------------- */

export async function initDatabase(): Promise<void> {
  if (driver) return
  driver = Capacitor.isNativePlatform()
    ? await createNativeDriver()
    : await createWebDriver()
  await runMigrations(driver)
}

function db(): DbDriver {
  if (!driver) throw new Error('数据库尚未初始化，请先调用 initDatabase()')
  return driver
}

export async function run(sql: string, params?: unknown[]): Promise<void> {
  return db().run(sql, params)
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T[]> {
  return db().query<T>(sql, params)
}

/** 显式事务：嵌套调用会被合并到最外层事务 */
export async function withTransaction(fn: () => Promise<void>): Promise<void> {
  if (txDepth > 0) return fn()
  await db().executeBatch('BEGIN TRANSACTION;')
  txDepth++
  try {
    await fn()
    await db().executeBatch('COMMIT;')
  } catch (e) {
    await db().executeBatch('ROLLBACK;')
    throw e
  } finally {
    txDepth--
  }
  // 事务落盘后触发 Web 端保存
  await db().run('PRAGMA user_version = user_version;')
}
