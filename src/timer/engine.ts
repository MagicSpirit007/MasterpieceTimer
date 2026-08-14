/**
 * 计时引擎 —— 纯函数。
 *
 * 计时真值只由 UTC 时间戳推导：
 *   有效时长 = 已固化累计 + （若 running）当前时间 - 当前段起点
 * 不使用 setInterval/rAF 逐秒累加；定时器仅用于刷新显示。
 * 因此后台挂起、锁屏、掉帧、进程被杀后重开都不会产生误差。
 */
import type { ActiveSessionSnapshot } from '../types/models'
import { clamp } from '../utils/format'

export function effectiveMs(s: ActiveSessionSnapshot, now: number): number {
  const running =
    s.state === 'running' && s.segmentStartedAtUtc != null
      ? now - s.segmentStartedAtUtc
      : 0
  return Math.max(0, s.accumulatedEffectiveMs + running)
}

export function pausedMs(s: ActiveSessionSnapshot, now: number): number {
  const pausing =
    s.state === 'paused' && s.pauseStartedAtUtc != null
      ? now - s.pauseStartedAtUtc
      : 0
  return Math.max(0, s.accumulatedPausedMs + pausing)
}

/** 从首次启动到现在的墙钟总时长（含暂停） */
export function totalElapsedMs(s: ActiveSessionSnapshot, now: number): number {
  return Math.max(0, now - s.startedAtUtc)
}

/** 上色进度：有效专注 / 计划时长，严格夹在 [0, 1] */
export function revealProgress(s: ActiveSessionSnapshot, now: number): number {
  const planned = Math.max(1, s.plannedSeconds * 1000)
  return clamp(effectiveMs(s, now) / planned, 0, 1)
}

/** 倒计时剩余毫秒（到 0 为止，不为负） */
export function remainingMs(s: ActiveSessionSnapshot, now: number): number {
  return Math.max(0, s.plannedSeconds * 1000 - effectiveMs(s, now))
}

/** 正计时是否已超出计划时长 */
export function isOvertime(s: ActiveSessionSnapshot, now: number): boolean {
  return effectiveMs(s, now) > s.plannedSeconds * 1000
}

/** 倒计时是否已到点 */
export function isFinished(s: ActiveSessionSnapshot, now: number): boolean {
  return remainingMs(s, now) <= 0
}
