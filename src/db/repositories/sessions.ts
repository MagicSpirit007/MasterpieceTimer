import type { FocusSession, SessionStatus, TimerMode } from '../../types/models'
import { query, run } from '../database'
import { emitDataChange } from '../events'
import { newId } from '../../utils/format'

interface SessionRow {
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
  isManual: number
  isEdited: number
  createdAt: number
  updatedAt: number
}

function toModel(r: SessionRow): FocusSession {
  return { ...r, isManual: r.isManual === 1, isEdited: r.isEdited === 1 }
}

export async function getSession(id: string): Promise<FocusSession | null> {
  const rows = await query<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id])
  return rows[0] ? toModel(rows[0]) : null
}

/** 时间范围内的已完成/中断记录（按开始时间倒序）。进行中的会话不入库。 */
export async function listSessionsInRange(
  startTs: number,
  endTs: number,
): Promise<FocusSession[]> {
  const rows = await query<SessionRow>(
    `SELECT * FROM sessions
     WHERE status != 'in_progress' AND endedAt IS NOT NULL
       AND startedAt < ? AND endedAt > ?
     ORDER BY startedAt DESC`,
    [endTs, startTs],
  )
  return rows.map(toModel)
}

export async function listSessionsByProject(
  projectId: string,
  limit = 100,
): Promise<FocusSession[]> {
  const rows = await query<SessionRow>(
    `SELECT * FROM sessions WHERE projectId = ? AND status != 'in_progress'
     ORDER BY startedAt DESC LIMIT ?`,
    [projectId, limit],
  )
  return rows.map(toModel)
}

export async function listAllSessions(): Promise<FocusSession[]> {
  const rows = await query<SessionRow>(
    `SELECT * FROM sessions WHERE status != 'in_progress' ORDER BY startedAt DESC`,
  )
  return rows.map(toModel)
}

export async function listRecentSessions(limit = 50): Promise<FocusSession[]> {
  const rows = await query<SessionRow>(
    `SELECT * FROM sessions WHERE status != 'in_progress'
     ORDER BY startedAt DESC LIMIT ?`,
    [limit],
  )
  return rows.map(toModel)
}

export type NewSessionInput = Omit<FocusSession, 'id' | 'createdAt' | 'updatedAt'>

export async function insertSession(input: NewSessionInput): Promise<FocusSession> {
  const now = Date.now()
  const s: FocusSession = { ...input, id: newId(), createdAt: now, updatedAt: now }
  await run(
    `INSERT INTO sessions (
      id, projectId, artworkId, timerMode, plannedSeconds, startedAt, endedAt,
      effectiveSeconds, pausedSeconds, completionRate, status, note,
      isManual, isEdited, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      s.id, s.projectId, s.artworkId, s.timerMode, s.plannedSeconds, s.startedAt,
      s.endedAt, s.effectiveSeconds, s.pausedSeconds, s.completionRate, s.status,
      s.note, s.isManual ? 1 : 0, s.isEdited ? 1 : 0, s.createdAt, s.updatedAt,
    ],
  )
  emitDataChange('sessions')
  return s
}

export async function updateSession(
  id: string,
  patch: Partial<Pick<FocusSession,
    'projectId' | 'artworkId' | 'timerMode' | 'plannedSeconds' | 'startedAt' |
    'endedAt' | 'effectiveSeconds' | 'pausedSeconds' | 'completionRate' |
    'status' | 'note' | 'isManual' | 'isEdited'>>,
): Promise<void> {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return
  const setSql = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = entries.map(([k, v]) =>
    k === 'isManual' || k === 'isEdited' ? (v ? 1 : 0) : v,
  )
  await run(`UPDATE sessions SET ${setSql}, updatedAt = ? WHERE id = ?`, [
    ...values,
    Date.now(),
    id,
  ])
  emitDataChange('sessions')
}

export async function deleteSession(id: string): Promise<void> {
  await run('DELETE FROM sessions WHERE id = ?', [id])
  emitDataChange('sessions')
}

/** 检测时间重叠（排除自身）。返回重叠的记录列表。 */
export async function findOverlappingSessions(
  startedAt: number,
  endedAt: number,
  excludeId?: string,
): Promise<FocusSession[]> {
  const rows = await query<SessionRow>(
    `SELECT * FROM sessions
     WHERE status != 'in_progress' AND endedAt IS NOT NULL
       AND startedAt < ? AND endedAt > ? ${excludeId ? 'AND id != ?' : ''}
     ORDER BY startedAt ASC`,
    excludeId ? [endedAt, startedAt, excludeId] : [endedAt, startedAt],
  )
  return rows.map(toModel)
}

/** 某画作全部已保存记录的有效时长总和（用于编辑/删除后重算画作进度） */
export async function sumEffectiveSecondsByArtwork(artworkId: string): Promise<number> {
  const rows = await query<{ total: number | null }>(
    `SELECT SUM(effectiveSeconds) AS total FROM sessions
     WHERE artworkId = ? AND status != 'in_progress'`,
    [artworkId],
  )
  return rows[0]?.total ?? 0
}

/** 某画作在某时间范围内的有效时长（用于关联项目等展示） */
export async function listSessionsByArtwork(artworkId: string): Promise<FocusSession[]> {
  const rows = await query<SessionRow>(
    `SELECT * FROM sessions WHERE artworkId = ? AND status != 'in_progress'
     ORDER BY startedAt DESC`,
    [artworkId],
  )
  return rows.map(toModel)
}
