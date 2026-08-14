/**
 * 统计聚合服务。
 * 跨日记录按「时间重叠比例」拆分到各日桶：记录的有效时长按
 * [startedAt, endedAt] 与每个统计桶的重叠比例分摊，保证日/月/年口径一致。
 */
import type { FocusSession } from '../types/models'
import { listSessionsInRange } from '../db/repositories/sessions'
import {
  addDays,
  secondsToHours,
  startOfDay,
  startOfMonth,
  startOfYear,
} from '../utils/format'
import { sessionSecondsInRange } from './statsMath'

export type StatsPeriod = 'date' | 'month' | 'year' | 'custom'

export interface StatsRange {
  start: number
  end: number // 开区间
}

export function resolveRange(
  period: StatsPeriod,
  anchor: number,
  customStart?: number,
  customEnd?: number,
): StatsRange {
  const now = Date.now()
  switch (period) {
    case 'date':
      return { start: startOfDay(anchor), end: addDays(startOfDay(anchor), 1) }
    case 'month': {
      const s = startOfMonth(anchor)
      const d = new Date(s)
      d.setMonth(d.getMonth() + 1)
      return { start: s, end: d.getTime() }
    }
    case 'year': {
      const s = startOfYear(anchor)
      const d = new Date(s)
      d.setFullYear(d.getFullYear() + 1)
      return { start: s, end: d.getTime() }
    }
    case 'custom': {
      const s = startOfDay(customStart ?? now)
      const e = addDays(startOfDay(customEnd ?? now), 1)
      return s < e ? { start: s, end: e } : { start: startOfDay(now), end: addDays(startOfDay(now), 1) }
    }
  }
}

export interface ProjectShare {
  projectId: string
  seconds: number
}

export interface TrendBucket {
  label: string
  hours: number
}

export interface StatsSummary {
  totalSeconds: number
  sessionCount: number
  averageSeconds: number
  byProject: ProjectShare[]
  trend: TrendBucket[]
  sessions: FocusSession[]
}

type BucketGranularity = 'hour' | 'day' | 'month'

function pickGranularity(range: StatsRange): BucketGranularity {
  const days = (range.end - range.start) / 86_400_000
  if (days <= 1.5) return 'hour'
  if (days <= 62) return 'day'
  return 'month'
}

function bucketOf(ts: number, g: BucketGranularity): string {
  const d = new Date(ts)
  if (g === 'hour') return `${String(d.getHours()).padStart(2, '0')}:00`
  if (g === 'day') return `${d.getMonth() + 1}/${d.getDate()}`
  return `${d.getFullYear()}/${d.getMonth() + 1}`
}

function allBuckets(range: StatsRange, g: BucketGranularity): { key: string; start: number; end: number }[] {
  const out: { key: string; start: number; end: number }[] = []
  if (g === 'hour') {
    for (let h = 0; h < 24; h++) {
      const s = range.start + h * 3_600_000
      out.push({ key: `${String(h).padStart(2, '0')}:00`, start: s, end: s + 3_600_000 })
    }
    return out
  }
  if (g === 'day') {
    for (let s = range.start; s < range.end; s = addDays(s, 1)) {
      out.push({ key: bucketOf(s, g), start: s, end: Math.min(addDays(s, 1), range.end) })
    }
    return out
  }
  const first = new Date(range.start)
  first.setDate(1)
  first.setHours(0, 0, 0, 0)
  let cur = first.getTime()
  while (cur < range.end) {
    const d = new Date(cur)
    d.setMonth(d.getMonth() + 1)
    out.push({ key: bucketOf(cur, g), start: Math.max(cur, range.start), end: Math.min(d.getTime(), range.end) })
    cur = d.getTime()
  }
  return out
}

export async function computeStats(range: StatsRange): Promise<StatsSummary> {
  const sessions = await listSessionsInRange(range.start, range.end)
  const byProjectMap = new Map<string, number>()
  let total = 0
  let counted = 0

  const g = pickGranularity(range)
  const buckets = allBuckets(range, g)
  const bucketSeconds = new Array<number>(buckets.length).fill(0)

  for (const s of sessions) {
    const eff = sessionSecondsInRange(s, range.start, range.end)
    if (eff <= 0) continue
    total += eff
    counted += 1
    byProjectMap.set(s.projectId, (byProjectMap.get(s.projectId) ?? 0) + eff)
    buckets.forEach((b, i) => {
      bucketSeconds[i] = (bucketSeconds[i] ?? 0) + sessionSecondsInRange(s, b.start, b.end)
    })
  }

  // 按小时粒度时裁剪尾部全空桶，避免长条空白
  let used = buckets.map((b, i) => ({ label: b.key, hours: secondsToHours(bucketSeconds[i] ?? 0) }))
  if (g === 'hour') {
    let last = 0
    used.forEach((b, i) => {
      if (b.hours > 0) last = i
    })
    used = used.slice(0, Math.max(last + 1, 1))
  }

  return {
    totalSeconds: Math.round(total),
    sessionCount: counted,
    averageSeconds: counted > 0 ? Math.round(total / counted) : 0,
    byProject: [...byProjectMap.entries()]
      .map(([projectId, seconds]) => ({ projectId, seconds: Math.round(seconds) }))
      .sort((a, b) => b.seconds - a.seconds),
    trend: used,
    sessions,
  }
}
