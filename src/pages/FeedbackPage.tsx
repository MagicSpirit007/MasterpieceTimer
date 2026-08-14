import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserSettings } from '../types/models'
import { loadSettings, saveSettings } from '../services/settings'
import { ensureNotificationPermission } from '../services/notifications'
import { Toggle } from '../components/ui'
import { useDataVersion } from '../db/events'
import styles from './SettingsPage.module.css'

export function FeedbackPage() {
  const navigate = useNavigate()
  const version = useDataVersion()
  const [settings, setSettings] = useState<UserSettings | null>(null)

  useEffect(() => {
    void loadSettings().then(setSettings)
  }, [version])

  const patch = async (next: Partial<UserSettings>) => {
    setSettings(await saveSettings(next))
  }

  if (!settings) return <div className="page" />

  return (
    <div className="page">
      <div className="row" style={{ padding: '12px 20px 0' }}>
        <button className="btn-ghost" style={{ minHeight: 36 }} onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
      </div>
      <h1 className="page-title">反馈</h1>
      <div className="page-scroll">
        <div className={styles.group}>
          <ToggleRow
            label="完成音"
            on={settings.soundEnabled}
            onChange={(v) => void patch({ soundEnabled: v })}
          />
          <ToggleRow
            label="触感"
            on={settings.hapticsEnabled}
            onChange={(v) => void patch({ hapticsEnabled: v })}
          />
          <ToggleRow
            label="结束通知"
            on={settings.notificationsEnabled}
            onChange={(v) => {
              void (async () => {
                if (v) await ensureNotificationPermission()
                await patch({ notificationsEnabled: v })
              })()
            }}
          />
        </div>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className={styles.toggleRow}>
      <span>{label}</span>
      <Toggle on={on} onChange={onChange} label={label} />
    </div>
  )
}
