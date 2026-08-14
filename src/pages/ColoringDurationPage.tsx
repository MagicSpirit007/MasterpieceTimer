import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DurationPicker } from '../components/ui'
import { useDataVersion } from '../db/events'
import { setAllRequiredFocusSeconds } from '../db/repositories/artworks'
import { loadSettings, saveSettings } from '../services/settings'
import styles from './SettingsPage.module.css'

const PRESETS = [15, 25, 45, 60, 90, 120]

export function ColoringDurationPage() {
  const navigate = useNavigate()
  const version = useDataVersion()
  const [minutes, setMinutes] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadSettings().then((s) => setMinutes(s.artworkColoringMinutes))
  }, [version])

  const apply = async (m: number) => {
    setMinutes(m)
    setSaving(true)
    try {
      await saveSettings({ artworkColoringMinutes: m })
      await setAllRequiredFocusSeconds(m * 60)
    } finally {
      setSaving(false)
    }
  }

  if (minutes == null) return <div className="page" />

  return (
    <div className="page">
      <div className="row" style={{ padding: '12px 20px 0' }}>
        <button className="btn-ghost" style={{ minHeight: 36 }} onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
      </div>
      <h1 className="page-title">上色时长</h1>
      <div className="page-scroll">
        <p className={`t3 xs ${styles.hint}`}>
          一幅画从全灰到上满色，需要多少有效专注。改完后所有画作共用这个分母。
        </p>
        <div className={styles.group}>
          <div className={styles.block}>
            <DurationPicker
              minutes={minutes}
              onChange={(m) => void apply(m)}
              presets={PRESETS}
              ariaLabel="上色所需时长"
            />
          </div>
        </div>
        <p className={`t3 xs ${styles.hint}`}>
          当前 {minutes} 分钟{saving ? ' · 正在保存' : ''}
        </p>
      </div>
    </div>
  )
}
