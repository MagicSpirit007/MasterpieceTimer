/**
 * 本地通知：倒计时结束提醒。
 * WebView 后台不可靠运行 JS，因此结束提醒交给系统调度；
 * 暂停/提前结束/修改时长时必须取消并重排。
 * Web 预览环境优雅降级为 no-op。
 */
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const cur = await LocalNotifications.checkPermissions()
    if (cur.display === 'granted') return true
    const req = await LocalNotifications.requestPermissions()
    return req.display === 'granted'
  } catch {
    return false
  }
}

/** 调度结束通知，返回通知 id；失败返回 null */
export async function scheduleFinishNotification(
  atTs: number,
  enabled: boolean,
): Promise<number | null> {
  if (!enabled || !Capacitor.isNativePlatform()) return null
  try {
    if (!(await ensureNotificationPermission())) return null
    const id = Math.floor(Date.now() % 2_000_000_000)
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: '专注完成',
          body: '画作已完全恢复色彩，来看看成果吧。',
          schedule: { at: new Date(atTs), allowWhileIdle: true },
        },
      ],
    })
    return id
  } catch {
    return null
  }
}

export async function cancelFinishNotification(id: number | null): Promise<void> {
  if (id == null || !Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] })
  } catch {
    /* 已过期或不存在，忽略 */
  }
}
