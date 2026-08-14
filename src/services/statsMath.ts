/** 统计用纯函数：不触数据库，便于单测。 */

export interface RangedSession {
  startedAt: number
  endedAt: number | null
  effectiveSeconds: number
}

/**
 * 会话在 [start, end) 内应计入的有效秒数。
 * 按 [startedAt, endedAt] 与统计桶的重叠比例分摊 effectiveSeconds。
 */
export function sessionSecondsInRange(
  s: RangedSession,
  start: number,
  end: number,
): number {
  const sStart = s.startedAt
  const sEnd = s.endedAt ?? s.startedAt
  const total = sEnd - sStart
  if (total <= 0) return 0
  const overlap = Math.max(0, Math.min(sEnd, end) - Math.max(sStart, start))
  return s.effectiveSeconds * (overlap / total)
}
