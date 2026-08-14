/** 计时模式：正计时 / 倒计时 */
export type TimerMode = 'countup' | 'countdown'

/** 专注会话状态 */
export type SessionStatus = 'completed' | 'interrupted' | 'in_progress'

/** 画作完成状态 */
export type CompletionStatus = 'in_progress' | 'completed'

/** 画作方向 */
export type Orientation = 'portrait' | 'landscape' | 'square'

/** 展示方式：架上画 / 手卷 */
export type ArtworkDisplayMode = 'easel' | 'handscroll'

export interface Project {
  id: string
  name: string
  color: string
  icon: string
  sortOrder: number
  isArchived: boolean
  createdAt: number
}

export interface Artwork {
  id: string
  title: string
  artist: string
  source: string
  licenseNote: string
  originalImageUri: string
  thumbnailUri: string
  /** 宽 / 高 */
  aspectRatio: number
  orientation: Orientation
  /** 提取的代表色，hex，如 '#8a7a5c'；提取失败为空串 */
  dominantColor: string
  /** 计划完成所需专注秒数（默认等于一次计划时长） */
  requiredFocusSeconds: number
  accumulatedFocusSeconds: number
  completionStatus: CompletionStatus
  completedAt: number | null
  /** 是否内置预设（预设不复制文件，直接引用打包资源） */
  isPreset: boolean
  note: string
  createdAt: number
  /** 历史底材，专注时覆盖用户默认画布 */
  canvasId: string
  /** 架上画左右上色；手卷自右向左走卷 */
  displayMode: ArtworkDisplayMode
}

export interface FocusSession {
  id: string
  projectId: string
  artworkId: string | null
  timerMode: TimerMode
  plannedSeconds: number
  startedAt: number
  endedAt: number | null
  effectiveSeconds: number
  pausedSeconds: number
  completionRate: number
  status: SessionStatus
  note: string
  isManual: boolean
  isEdited: boolean
  createdAt: number
  updatedAt: number
}

export interface UserSettings {
  userName: string
  avatarUri: string
  defaultTimerMode: TimerMode
  defaultPlannedMinutes: number
  soundEnabled: boolean
  hapticsEnabled: boolean
  notificationsEnabled: boolean
  /** 外观：跟随系统 / 浅色 / 深色 */
  appearance: 'system' | 'light' | 'dark'
  /** 非专注页默认画布 */
  canvasId: string
  /** 完成一幅画上色所需有效专注（分钟） */
  artworkColoringMinutes: number
  /** 最近一次专注配置，用于减少重复操作 */
  lastProjectId: string | null
  lastTimerMode: TimerMode
  lastPlannedMinutes: number
  lastArtworkId: string | null
  dataVersion: number
}

/** 进行中的会话快照：持久化到 Preferences，是后台/杀进程后恢复计时的真值来源 */
export interface ActiveSessionSnapshot {
  id: string
  projectId: string
  artworkId: string
  timerMode: TimerMode
  plannedSeconds: number
  /** 首次启动的 UTC 毫秒时间戳 */
  startedAtUtc: number
  /** 当前运行段之前已累计的有效毫秒 */
  accumulatedEffectiveMs: number
  /** 当前运行段起点（running 时有效） */
  segmentStartedAtUtc: number | null
  /** 已累计暂停毫秒 */
  accumulatedPausedMs: number
  /** 本次暂停起点（paused 时有效） */
  pauseStartedAtUtc: number | null
  state: 'running' | 'paused'
  /** 已调度的本地通知 id（倒计时模式） */
  notificationId: number | null
}
