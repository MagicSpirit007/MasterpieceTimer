/**
 * 专注页订阅 hook：以 4Hz 刷新显示（显示层唯一职责），
 * 计时真值永远来自 engine 纯函数 + UTC 时间戳。
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { focusController } from './focusController'
import * as engine from './engine'
import type { ActiveSessionSnapshot } from '../types/models'

export interface FocusTick {
  snapshot: ActiveSessionSnapshot | null
  /** 显示用当前时间戳（每 250ms 更新） */
  now: number
}

export function useFocusTimer(onAutoComplete?: () => void): FocusTick {
  const snapshot = useSyncExternalStore(
    (fn) => focusController.subscribe(fn),
    () => focusController.getSnapshot(),
  )
  const [, setTick] = useState(0)
  const completingRef = useRef(false)
  const onAutoCompleteRef = useRef(onAutoComplete)
  onAutoCompleteRef.current = onAutoComplete

  useEffect(() => {
    if (!snapshot) return
    const timer = setInterval(() => {
      setTick((v) => v + 1)
      if (!completingRef.current) {
        void focusController.onTick(Date.now()).then((event) => {
          if (event === 'completed' && !completingRef.current) {
            completingRef.current = true
            onAutoCompleteRef.current?.()
          }
        })
      }
    }, 250)
    return () => clearInterval(timer)
  }, [snapshot])

  return { snapshot, now: Date.now() }
}

/** 便捷派生：供专注页直接消费的显示数据 */
export function deriveFocusDisplay(s: ActiveSessionSnapshot, now: number) {
  const effMs = engine.effectiveMs(s, now)
  const effectiveSeconds = Math.floor(effMs / 1000)
  const progress = engine.revealProgress(s, now)
  const remainingSeconds = Math.ceil(engine.remainingMs(s, now) / 1000)
  const overtimeSeconds =
    s.timerMode === 'countup' ? Math.max(0, effectiveSeconds - s.plannedSeconds) : 0
  return {
    effectiveSeconds,
    progress,
    remainingSeconds,
    overtimeSeconds,
    pausedSeconds: Math.floor(engine.pausedMs(s, now) / 1000),
    isPaused: s.state === 'paused',
  }
}
