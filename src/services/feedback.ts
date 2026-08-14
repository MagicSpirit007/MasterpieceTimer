/** 完成反馈：触感 + 轻量提示音，均可在设置中关闭 */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export async function hapticImpact(enabled: boolean): Promise<void> {
  if (!enabled || !Capacitor.isNativePlatform()) return
  try {
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch {
    /* 设备不支持时忽略 */
  }
}

export async function hapticSuccess(enabled: boolean): Promise<void> {
  if (!enabled || !Capacitor.isNativePlatform()) return
  try {
    await Haptics.notification({ type: NotificationType.Success })
  } catch {
    /* ignore */
  }
}

/** WebAudio 合成的极简完成音（两个柔和正弦音），避免引入音频资源文件 */
export function playCompletionSound(enabled: boolean): void {
  if (!enabled) return
  try {
    const Ctx = window.AudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const notes = [523.25, 783.99] // C5 → G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.18
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 0.65)
    })
    setTimeout(() => void ctx.close(), 1500)
  } catch {
    /* 浏览器自动播放策略拦截时忽略 */
  }
}
