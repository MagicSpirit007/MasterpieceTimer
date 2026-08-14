import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { applyAppearance, loadSettings } from '../services/settings'
import {
  clearAllUserData,
  downloadBackupJson,
  exportBackup,
  importBackup,
  parseBackupJson,
} from '../services/dataBackup'
import { ConfirmSheet } from '../components/ui'
import styles from './SettingsPage.module.css'

export function DataPage() {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<'clear' | 'import' | null>(null)
  const [pendingImport, setPendingImport] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="page">
      <div className="row" style={{ padding: '12px 20px 0' }}>
        <button className="btn-ghost" style={{ minHeight: 36 }} onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
      </div>
      <h1 className="page-title">数据</h1>
      <div className="page-scroll">
        <div className={styles.group}>
          <button
            className={styles.navRow}
            disabled={busy != null}
            onClick={() =>
              void (async () => {
                setBusy('export')
                try {
                  downloadBackupJson(await exportBackup())
                } finally {
                  setBusy(null)
                }
              })()
            }
          >
            <span>导出备份</span>
            <span className={styles.chev}>{busy === 'export' ? '…' : 'JSON ›'}</span>
          </button>
          <button className={styles.navRow} onClick={() => fileRef.current?.click()}>
            <span>导入备份</span>
            <span className={styles.chev}>覆盖当前数据 ›</span>
          </button>
          <button
            className={`${styles.navRow} ${styles.danger}`}
            onClick={() => setConfirm('clear')}
          >
            <span>清空全部数据</span>
            <span className={styles.chev}>不可撤销</span>
          </button>
        </div>
        <p className={`t3 xs ${styles.hint}`}>
          备份包含项目、专注记录和画作元数据，不含画作原图。导入后自行导入的图片需要重新添加。
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          void file.text().then((text) => {
            try {
              parseBackupJson(text)
              setPendingImport(text)
              setConfirm('import')
            } catch (err) {
              window.alert(err instanceof Error ? err.message : '无法读取备份')
            }
          })
        }}
      />

      <ConfirmSheet
        open={confirm === 'import'}
        title="导入并覆盖？"
        message="当前项目、记录和画作元数据将被这份备份替换。画作原图不会随备份恢复。"
        confirmLabel="导入"
        danger
        onConfirm={() => {
          const text = pendingImport
          setConfirm(null)
          setPendingImport(null)
          if (!text) return
          void (async () => {
            setBusy('import')
            try {
              await importBackup(parseBackupJson(text))
              applyAppearance((await loadSettings()).appearance)
            } catch (err) {
              window.alert(err instanceof Error ? err.message : '导入失败')
            } finally {
              setBusy(null)
            }
          })()
        }}
        onCancel={() => {
          setConfirm(null)
          setPendingImport(null)
        }}
      />

      <ConfirmSheet
        open={confirm === 'clear'}
        title="清空全部数据？"
        message="将删除所有项目、专注记录和自行导入的画作，并恢复内置名画。此操作不可撤销。"
        confirmLabel="清空"
        danger
        onConfirm={() => {
          setConfirm(null)
          void (async () => {
            setBusy('clear')
            try {
              await clearAllUserData()
              applyAppearance('system')
              navigate('/', { replace: true })
            } finally {
              setBusy(null)
            }
          })()
        }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
