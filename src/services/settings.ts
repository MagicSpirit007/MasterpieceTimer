/**
 * 用户设置：轻量偏好存 @capacitor/preferences（Web 端由其 localStorage 实现承载）。
 * 正式业务数据（项目/画作/记录）在 SQLite，不经过这里。
 */
import { Preferences } from '@capacitor/preferences'
import type { UserSettings } from '../types/models'
import { emitDataChange } from '../db/events'
import { applyCanvas, DEFAULT_CANVAS_ID, resolveCanvasId } from './canvasCatalog'

const KEY = 'userSettings'

export const DEFAULT_SETTINGS: UserSettings = {
  userName: '专注者',
  avatarUri: '',
  defaultTimerMode: 'countdown',
  defaultPlannedMinutes: 25,
  soundEnabled: true,
  hapticsEnabled: true,
  notificationsEnabled: true,
  appearance: 'system',
  canvasId: DEFAULT_CANVAS_ID,
  artworkColoringMinutes: 45,
  lastProjectId: null,
  lastTimerMode: 'countdown',
  lastPlannedMinutes: 25,
  lastArtworkId: null,
  dataVersion: 1,
}

let cache: UserSettings | null = null

export async function loadSettings(): Promise<UserSettings> {
  if (cache) return cache
  const { value } = await Preferences.get({ key: KEY })
  const parsed = value ? (JSON.parse(value) as Partial<UserSettings>) : {}
  const coloring =
    typeof parsed.artworkColoringMinutes === 'number' && parsed.artworkColoringMinutes >= 1
      ? Math.round(parsed.artworkColoringMinutes)
      : DEFAULT_SETTINGS.artworkColoringMinutes
  cache = {
    ...DEFAULT_SETTINGS,
    ...parsed,
    canvasId: resolveCanvasId(parsed.canvasId, DEFAULT_CANVAS_ID),
    artworkColoringMinutes: coloring,
  }
  return cache
}

export async function saveSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
  const next = { ...(await loadSettings()), ...patch }
  cache = next
  await Preferences.set({ key: KEY, value: JSON.stringify(next) })
  emitDataChange('settings')
  return next
}

export async function resetSettings(): Promise<UserSettings> {
  cache = { ...DEFAULT_SETTINGS }
  await Preferences.set({ key: KEY, value: JSON.stringify(cache) })
  emitDataChange('settings')
  return cache
}

let schemeMq: MediaQueryList | null = null
let schemeHandler: (() => void) | null = null

/** 应用外观设置到 <html data-theme>，并在「跟随系统」时持续监听切换 */
export function applyAppearance(appearance: UserSettings['appearance']): void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    const dark = appearance === 'dark' || (appearance === 'system' && mq.matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }
  if (schemeMq && schemeHandler) {
    schemeMq.removeEventListener('change', schemeHandler)
  }
  schemeMq = mq
  schemeHandler = apply
  if (appearance === 'system') {
    mq.addEventListener('change', apply)
  }
  apply()
}

export function applyCanvasSetting(canvasId: string): void {
  applyCanvas(resolveCanvasId(canvasId))
}
