/**
 * 日期/时间选择。
 * 原生：@pantrist/capacitor-date-picker（iOS 系统选择器）。
 * Web 预览：语义等价的 <input type="date"> / <input type="time"> 由调用方渲染，
 * 本模块仅在原生端被调用；插件不可用时返回 null，由调用方回退到手动输入。
 */
import { Capacitor } from '@capacitor/core'

export interface NativePickResult {
  /** 用户确认后的时间戳；取消返回 null */
  ts: number | null
}

async function pickNative(mode: 'date' | 'time', value: number): Promise<number | null> {
  if (!Capacitor.isNativePlatform()) return null
  try {
    const { DatePicker } = await import('@pantrist/capacitor-date-picker')
    const result = await DatePicker.present({
      mode,
      date: new Date(value).toISOString(),
      is24h: true,
      doneText: '完成',
      cancelText: '取消',
      ios: { style: 'wheels' },
    })
    const v = (result as { value?: string }).value
    if (!v) return null
    const ts = new Date(v).getTime()
    return Number.isNaN(ts) ? null : ts
  } catch {
    return null // 用户取消或插件不可用
  }
}

export async function pickDateNative(value: number): Promise<NativePickResult> {
  return { ts: await pickNative('date', value) }
}

export async function pickTimeNative(value: number): Promise<NativePickResult> {
  return { ts: await pickNative('time', value) }
}

export const isNativePickerAvailable = Capacitor.isNativePlatform()
