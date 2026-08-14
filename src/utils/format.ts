/** 时间与格式化工具 */

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

/** 秒 → "MM:SS" 或 "H:MM:SS" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

/** 秒 → "1 小时 25 分钟" / "5 分钟" / "40 秒" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds)
  if (s < 60) return `${s} 秒`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  if (h > 0) return m > 0 ? `${h} 小时 ${m} 分钟` : `${h} 小时`
  return `${m} 分钟`
}

/** 秒 → 小时（保留 1 位小数，用于统计图表单位） */
export function secondsToHours(s: number): number {
  return Math.round((s / 3600) * 10) / 10
}

/** 上色时长：小时一位小数，内部仍存整分钟 */
export const COLORING_HOURS_MIN = 0.1
export const COLORING_HOURS_MAX = 24

export function minutesToColoringHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10
}

export function coloringHoursToMinutes(hours: number): number {
  const h = clamp(Math.round(hours * 10) / 10, COLORING_HOURS_MIN, COLORING_HOURS_MAX)
  return Math.max(1, Math.round(h * 60))
}

export function formatColoringHours(minutes: number): string {
  return minutesToColoringHours(minutes).toFixed(1)
}

/** 时间戳 → "HH:MM" */
export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 时间戳 → "YYYY-MM-DD"（本地时区） */
export function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 时间戳 → "M月D日" */
export function formatDateShort(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)} ${formatTime(ts)}`
}

/** 当日 0 点时间戳 */
export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function startOfYear(ts: number): number {
  const d = new Date(ts)
  d.setMonth(0, 1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/** "YYYY-MM-DD" + "HH:MM" → 本地时间戳；非法输入返回 null */
export function parseLocalDateTime(date: string, time: string): number | null {
  if (!date || !time) return null
  const ts = new Date(`${date}T${time}:00`).getTime()
  return Number.isNaN(ts) ? null : ts
}

export function newId(): string {
  return crypto.randomUUID()
}
