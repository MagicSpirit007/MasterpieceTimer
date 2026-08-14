import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { UserSettings } from '../types/models'
import {
  applyAppearance,
  applyCanvasSetting,
  loadSettings,
  saveSettings,
} from '../services/settings'
import { CANVAS_CATALOG, type CanvasId } from '../services/canvasCatalog'
import { SegmentedControl } from '../components/ui'
import { useDataVersion } from '../db/events'
import styles from './SettingsPage.module.css'

export function AppearancePage() {
  const navigate = useNavigate()
  const version = useDataVersion()
  const [settings, setSettings] = useState<UserSettings | null>(null)

  useEffect(() => {
    void loadSettings().then(setSettings)
  }, [version])

  const patch = async (next: Partial<UserSettings>) => {
    const saved = await saveSettings(next)
    setSettings(saved)
    if (next.appearance) applyAppearance(saved.appearance)
    if (next.canvasId) applyCanvasSetting(saved.canvasId)
  }

  if (!settings) return <div className="page" />

  return (
    <div className="page">
      <div className="row" style={{ padding: '12px 20px 0' }}>
        <button className="btn-ghost" style={{ minHeight: 36 }} onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
      </div>
      <h1 className="page-title">外观</h1>
      <div className="page-scroll">
        <p className="section-label">明暗</p>
        <div className={styles.group}>
          <div className={styles.block}>
            <SegmentedControl<UserSettings['appearance']>
              ariaLabel="外观"
              value={settings.appearance}
              onChange={(v) => void patch({ appearance: v })}
              options={[
                { value: 'system', label: '跟随系统' },
                { value: 'light', label: '浅色' },
                { value: 'dark', label: '深色' },
              ]}
            />
          </div>
        </div>

        <p className="section-label">画布</p>
        <p className={`t3 xs ${styles.hint}`}>
          非专注页使用所选画布。专注时改用该画的历史底材。
        </p>
        <div className={styles.canvasGrid} role="listbox" aria-label="画布样式">
          {CANVAS_CATALOG.map((c) => (
            <button
              key={c.id}
              role="option"
              aria-selected={settings.canvasId === c.id}
              className={styles.canvasCard}
              data-active={settings.canvasId === c.id}
              onClick={() => void patch({ canvasId: c.id as CanvasId })}
            >
              <span
                className={`canvas-swatch ${styles.canvasPreview}`}
                data-canvas={c.id}
              />
              <span className={styles.canvasName}>{c.name}</span>
              <span className={styles.canvasNote}>{c.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
