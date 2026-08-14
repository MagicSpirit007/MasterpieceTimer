import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataVersion } from '../db/events'
import { setAllRequiredFocusSeconds } from '../db/repositories/artworks'
import { loadSettings, saveSettings } from '../services/settings'
import {
  COLORING_HOURS_MAX,
  COLORING_HOURS_MIN,
  coloringHoursToMinutes,
  formatColoringHours,
} from '../utils/format'
import styles from './SettingsPage.module.css'

export function ColoringDurationPage() {
  const navigate = useNavigate()
  const version = useDataVersion()
  const [minutes, setMinutes] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadSettings().then((s) => {
      setMinutes(s.artworkColoringMinutes)
      setDraft(formatColoringHours(s.artworkColoringMinutes))
    })
  }, [version])

  const applyMinutes = async (m: number) => {
    if (minutes === m) {
      setDraft(formatColoringHours(m))
      return
    }
    setMinutes(m)
    setDraft(formatColoringHours(m))
    setSaving(true)
    try {
      await saveSettings({ artworkColoringMinutes: m })
      await setAllRequiredFocusSeconds(m * 60)
    } finally {
      setSaving(false)
    }
  }

  const commit = (raw: string) => {
    if (minutes == null) return
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      setDraft(formatColoringHours(minutes))
      return
    }
    void applyMinutes(coloringHoursToMinutes(n))
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
          一幅画完成上色需要的有效专注时长。
        </p>
        <div className={styles.group}>
          <div className={styles.block}>
            <div className={styles.hoursRow}>
              <input
                className={`field ${styles.hoursField}`}
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                aria-label="上色所需小时数"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => commit(draft)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.currentTarget as HTMLInputElement).blur()
                  }
                }}
              />
              <span className={styles.hoursUnit}>小时</span>
            </div>
          </div>
        </div>
        <p className={`t3 xs ${styles.hint}`}>
          {COLORING_HOURS_MIN.toFixed(1)}–{COLORING_HOURS_MAX.toFixed(1)} 小时
          {saving ? ' · 保存中' : ''}
        </p>
      </div>
    </div>
  )
}
