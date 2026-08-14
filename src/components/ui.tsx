/** 通用 UI 原语：Sheet / 确认框 / 分段控件 / 开关 / 时长选择 */
import { useEffect, type ReactNode } from 'react'
import styles from './ui.module.css'

/* ---------- 底部弹层 ---------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.sheet}>
        <div className={styles.sheetHandle} />
        {title && <h2 className={styles.sheetTitle}>{title}</h2>}
        {children}
      </div>
    </div>
  )
}

/* ---------- 确认弹层（不可逆操作二次确认） ---------- */

export function ConfirmSheet({
  open,
  title,
  message,
  confirmLabel = '确认',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      {message && (
        <p className="t2 small" style={{ marginBottom: 16 }}>
          {message}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          className={`btn-ghost ${danger ? 'btn-danger' : ''}`}
          style={danger ? { background: 'var(--danger-soft)' } : undefined}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          取消
        </button>
      </div>
    </Sheet>
  )
}

/* ---------- 分段控件 ---------- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <div className={styles.segmented} role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          data-active={value === o.value}
          className={styles.segItem}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- 开关 ---------- */

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      className={styles.toggle}
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-on={on}
      onClick={() => onChange(!on)}
    />
  )
}

/* ---------- 计划时长选择 ---------- */

const PRESET_MINUTES = [5, 10, 15, 25, 45, 60, 90, 120]

export function DurationPicker({
  minutes,
  onChange,
  presets = PRESET_MINUTES,
  ariaLabel = '计划时长',
}: {
  minutes: number
  onChange: (m: number) => void
  presets?: number[]
  ariaLabel?: string
}) {
  const isPreset = presets.includes(minutes)
  return (
    <div className={styles.durationSlotInner}>
      <div className={styles.durationChips} role="listbox" aria-label={ariaLabel}>
        {presets.map((m) => (
          <button
            key={m}
            role="option"
            aria-selected={minutes === m}
            data-active={minutes === m}
            className={styles.chip}
            onClick={() => onChange(m)}
          >
            {m} 分钟
          </button>
        ))}
        <button
          data-active={!isPreset}
          className={styles.chip}
          onClick={() => !isPreset || onChange(35)}
        >
          自定义
        </button>
      </div>
      {!isPreset && (
        <div className="row" style={{ marginTop: 12, justifyContent: 'center' }}>
          <input
            className="field"
            style={{ width: 120, textAlign: 'center' }}
            type="number"
            min={1}
            max={480}
            value={minutes}
            aria-label="自定义分钟数"
            onChange={(e) => {
              const v = Math.round(Number(e.target.value))
              if (v >= 1 && v <= 480) onChange(v)
            }}
          />
          <span className="t2">分钟</span>
        </div>
      )}
    </div>
  )
}
