/**
 * 进行中会话快照的持久化。
 * 进入后台、暂停/恢复、每次关键状态变化都会写快照；
 * 应用重启后据此按 UTC 时间戳重算真实进度。
 */
import { Preferences } from '@capacitor/preferences'
import type { ActiveSessionSnapshot } from '../types/models'

const KEY = 'activeFocusSession'

export async function saveActiveSession(s: ActiveSessionSnapshot): Promise<void> {
  await Preferences.set({ key: KEY, value: JSON.stringify(s) })
}

export async function loadActiveSession(): Promise<ActiveSessionSnapshot | null> {
  const { value } = await Preferences.get({ key: KEY })
  if (!value) return null
  try {
    return JSON.parse(value) as ActiveSessionSnapshot
  } catch {
    return null
  }
}

export async function clearActiveSession(): Promise<void> {
  await Preferences.remove({ key: KEY })
}
