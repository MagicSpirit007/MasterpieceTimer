/**
 * 专注会话控制器（模块级单例）。
 *
 * 职责：生命周期（开始/暂停/恢复/结束）、快照持久化、
 * 前后台切换处理、结束通知调度、完成反馈。
 * React 只通过 useFocusTimer 订阅它的状态。
 */
import { App as CapApp } from '@capacitor/app'
import type {
  ActiveSessionSnapshot,
  FocusSession,
  TimerMode,
} from '../types/models'
import * as engine from './engine'
import {
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
} from '../services/activeSession'
import {
  cancelFinishNotification,
  scheduleFinishNotification,
} from '../services/notifications'
import { hapticSuccess, playCompletionSound } from '../services/feedback'
import { loadSettings } from '../services/settings'
import { insertSession } from '../db/repositories/sessions'
import { accumulateArtworkFocus } from '../db/repositories/artworks'
import { newId } from '../utils/format'

export interface StartConfig {
  projectId: string
  artworkId: string
  timerMode: TimerMode
  plannedSeconds: number
}

type Listener = () => void

class FocusController {
  private snapshot: ActiveSessionSnapshot | null = null
  private listeners = new Set<Listener>()
  private appStateHooked = false
  /** 正计时到达计划时只反馈一次 */
  private overtimeNotified = false

  /* ---------- 订阅 ---------- */

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn())
  }

  getSnapshot(): ActiveSessionSnapshot | null {
    return this.snapshot
  }

  /* ---------- 生命周期 ---------- */

  async start(
    config: StartConfig,
    opts: { ifActive?: 'save' | 'discard' } = {},
  ): Promise<void> {
    if (this.snapshot) {
      if (opts.ifActive === 'save') {
        await this.finish('interrupted', '')
      } else if (opts.ifActive === 'discard') {
        await this.discard()
      } else {
        throw new Error('ACTIVE_SESSION_EXISTS')
      }
    }
    const now = Date.now()
    const settings = await loadSettings()
    const snapshot: ActiveSessionSnapshot = {
      id: newId(),
      projectId: config.projectId,
      artworkId: config.artworkId,
      timerMode: config.timerMode,
      plannedSeconds: config.plannedSeconds,
      startedAtUtc: now,
      accumulatedEffectiveMs: 0,
      segmentStartedAtUtc: now,
      accumulatedPausedMs: 0,
      pauseStartedAtUtc: null,
      state: 'running',
      notificationId: null,
    }
    if (config.timerMode === 'countdown') {
      snapshot.notificationId = await scheduleFinishNotification(
        now + config.plannedSeconds * 1000,
        settings.notificationsEnabled,
      )
    }
    this.snapshot = snapshot
    this.overtimeNotified = false
    await saveActiveSession(snapshot)
    this.hookAppState()
    this.emit()
  }

  async pause(): Promise<void> {
    const s = this.snapshot
    if (!s || s.state !== 'running') return
    const now = Date.now()
    s.accumulatedEffectiveMs += now - (s.segmentStartedAtUtc ?? now)
    s.segmentStartedAtUtc = null
    s.state = 'paused'
    s.pauseStartedAtUtc = now
    await cancelFinishNotification(s.notificationId)
    s.notificationId = null
    await saveActiveSession(s)
    this.emit()
  }

  async resume(): Promise<void> {
    const s = this.snapshot
    if (!s || s.state !== 'paused') return
    const now = Date.now()
    s.accumulatedPausedMs += now - (s.pauseStartedAtUtc ?? now)
    s.pauseStartedAtUtc = null
    s.state = 'running'
    s.segmentStartedAtUtc = now
    if (s.timerMode === 'countdown') {
      const settings = await loadSettings()
      s.notificationId = await scheduleFinishNotification(
        now + engine.remainingMs(s, now),
        settings.notificationsEnabled,
      )
    }
    await saveActiveSession(s)
    this.emit()
  }

  /**
   * 结束本次专注并保存记录。
   * @param status completed = 达标/倒计时归零；interrupted = 用户提前保存
   * @returns 保存的记录；放弃时返回 null
   */
  async finish(status: 'completed' | 'interrupted', note: string): Promise<FocusSession | null> {
    const s = this.snapshot
    if (!s) return null
    const now = Date.now()
    const effectiveSeconds = Math.round(engine.effectiveMs(s, now) / 1000)
    await cancelFinishNotification(s.notificationId)

    const session = await insertSession({
      projectId: s.projectId,
      artworkId: s.artworkId,
      timerMode: s.timerMode,
      plannedSeconds: s.plannedSeconds,
      startedAt: s.startedAtUtc,
      endedAt: now,
      effectiveSeconds,
      pausedSeconds: Math.round(engine.pausedMs(s, now) / 1000),
      completionRate: engine.revealProgress(s, now),
      status,
      note,
      isManual: false,
      isEdited: false,
    })
    if (effectiveSeconds > 0) {
      await accumulateArtworkFocus(s.artworkId, effectiveSeconds)
    }
    await clearActiveSession()
    this.snapshot = null
    this.emit()
    return session
  }

  /** 放弃本次记录：清空快照，不落库 */
  async discard(): Promise<void> {
    const s = this.snapshot
    if (s) await cancelFinishNotification(s.notificationId)
    await clearActiveSession()
    this.snapshot = null
    this.emit()
  }

  /* ---------- 前后台与恢复 ---------- */

  /** 应用启动时调用：若有未完成快照则恢复（返回是否存在） */
  async restore(): Promise<boolean> {
    const saved = await loadActiveSession()
    if (!saved) return false
    this.snapshot = saved
    this.overtimeNotified = engine.isOvertime(saved, Date.now())
    this.hookAppState()
    // 倒计时在后台期间已到点：回到前台立即按时间戳结算
    if (saved.timerMode === 'countdown' && engine.isFinished(saved, Date.now())) {
      this.emit()
    }
    this.emit()
    return true
  }

  private hookAppState(): void {
    if (this.appStateHooked) return
    this.appStateHooked = true
    void CapApp.addListener('appStateChange', ({ isActive }) => {
      void (async () => {
        if (!this.snapshot) return
        if (!isActive) {
          // 进入后台：立即固化当前进度快照
          const s = this.snapshot
          if (s.state === 'running' && s.segmentStartedAtUtc != null) {
            s.accumulatedEffectiveMs += Date.now() - s.segmentStartedAtUtc
            s.segmentStartedAtUtc = Date.now()
          }
          await saveActiveSession(s)
        } else {
          // 回到前台：按时间戳重算（engine 纯函数自动吸收离线时长）
          this.emit()
        }
      })()
    })
  }

  /** 每帧/每 tick 由 hook 调用：处理到达计划时点的反馈与倒计时自动完成 */
  async onTick(now: number): Promise<'completed' | 'overtime' | null> {
    const s = this.snapshot
    if (!s || s.state !== 'running') return null
    if (s.timerMode === 'countdown' && engine.isFinished(s, now)) {
      const settings = await loadSettings()
      await hapticSuccess(settings.hapticsEnabled)
      playCompletionSound(settings.soundEnabled)
      return 'completed'
    }
    if (s.timerMode === 'countup' && !this.overtimeNotified && engine.isOvertime(s, now)) {
      this.overtimeNotified = true
      const settings = await loadSettings()
      await hapticSuccess(settings.hapticsEnabled)
      playCompletionSound(settings.soundEnabled)
      return 'overtime'
    }
    return null
  }
}

export const focusController = new FocusController()
