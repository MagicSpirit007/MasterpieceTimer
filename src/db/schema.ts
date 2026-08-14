/**
 * Schema 与显式版本迁移。
 * 通过 PRAGMA user_version 记录版本；新增结构变更时向 MIGRATIONS 追加脚本，
 * 不要修改已发布的历史脚本。
 */
import type { DbDriver } from './database'

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '',
        icon TEXT NOT NULL DEFAULT '',
        sortOrder INTEGER NOT NULL DEFAULT 0,
        isArchived INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS artworks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL DEFAULT '',
        source TEXT NOT NULL DEFAULT '',
        licenseNote TEXT NOT NULL DEFAULT '',
        originalImageUri TEXT NOT NULL,
        thumbnailUri TEXT NOT NULL DEFAULT '',
        aspectRatio REAL NOT NULL DEFAULT 1,
        orientation TEXT NOT NULL DEFAULT 'square',
        dominantColor TEXT NOT NULL DEFAULT '',
        requiredFocusSeconds INTEGER NOT NULL DEFAULT 1500,
        accumulatedFocusSeconds INTEGER NOT NULL DEFAULT 0,
        completionStatus TEXT NOT NULL DEFAULT 'in_progress',
        completedAt INTEGER,
        isPreset INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        artworkId TEXT,
        timerMode TEXT NOT NULL,
        plannedSeconds INTEGER NOT NULL,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER,
        effectiveSeconds INTEGER NOT NULL DEFAULT 0,
        pausedSeconds INTEGER NOT NULL DEFAULT 0,
        completionRate REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        isManual INTEGER NOT NULL DEFAULT 0,
        isEdited INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_startedAt ON sessions(startedAt);
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(projectId);
      CREATE INDEX IF NOT EXISTS idx_sessions_artwork ON sessions(artworkId);
      CREATE INDEX IF NOT EXISTS idx_projects_sort ON projects(isArchived, sortOrder);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE artworks ADD COLUMN canvasId TEXT NOT NULL DEFAULT 'oil-linen';
      ALTER TABLE artworks ADD COLUMN displayMode TEXT NOT NULL DEFAULT 'easel';
    `,
  },
]

function splitStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function isIgnorableSchemaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err)
  return /duplicate column|already exists/i.test(msg)
}

export async function runMigrations(driver: DbDriver): Promise<void> {
  const rows = await driver.query<{ user_version: number }>(
    'PRAGMA user_version;',
  )
  const current = rows[0]?.user_version ?? 0
  for (const m of MIGRATIONS) {
    if (m.version > current) {
      for (const stmt of splitStatements(m.sql)) {
        try {
          await driver.executeBatch(`${stmt};`)
        } catch (err) {
          if (!isIgnorableSchemaError(err)) throw err
        }
      }
      await driver.executeBatch(`PRAGMA user_version = ${m.version};`)
    }
  }
}
