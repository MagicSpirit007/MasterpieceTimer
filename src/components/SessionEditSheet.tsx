/** 补记 / 编辑专注记录的共用弹层表单 */
import { useEffect, useState } from 'react'
import type { Artwork, FocusSession, Project } from '../types/models'
import { listProjects } from '../db/repositories/projects'
import {
  listArtworks,
  recomputeArtworkAccumulation,
} from '../db/repositories/artworks'
import {
  deleteSession,
  findOverlappingSessions,
  insertSession,
  sumEffectiveSecondsByArtwork,
  updateSession,
} from '../db/repositories/sessions'
import { ConfirmSheet, Sheet } from './ui'
import {
  isNativePickerAvailable,
  pickDateNative,
  pickTimeNative,
} from '../services/datePicker'
import { formatDate, formatTime, parseLocalDateTime } from '../utils/format'
import styles from './SessionEditSheet.module.css'

export interface SessionEditSheetProps {
  open: boolean
  onClose: () => void
  /** create = 补记；edit = 编辑已有记录 */
  mode: 'create' | 'edit'
  /** edit 模式必传 */
  session?: FocusSession
  /** create 模式预选项目 */
  defaultProjectId?: string
  onSaved: () => void
}

/** 只改日期，保留原时间 */
function withDate(ts: number, date: string): number | null {
  return parseLocalDateTime(date, formatTime(ts))
}

/** 只改时间，保留原日期 */
function withTime(ts: number, time: string): number | null {
  return parseLocalDateTime(formatDate(ts), time)
}

/** 一组日期 + 时间输入：原生端用系统选择器，Web 端用 input */
function DateTimeFields({
  label,
  ts,
  onChange,
}: {
  label: string
  ts: number
  onChange: (ts: number) => void
}) {
  const applyDate = (date: string) => {
    const merged = withDate(ts, date)
    if (merged != null) onChange(merged)
  }
  const applyTime = (time: string) => {
    const merged = withTime(ts, time)
    if (merged != null) onChange(merged)
  }
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      {isNativePickerAvailable ? (
        <div className={styles.dtRow}>
          <button
            type="button"
            className={`field ${styles.pickerBtn}`}
            onClick={async () => {
              const { ts: picked } = await pickDateNative(ts)
              if (picked != null) applyDate(formatDate(picked))
            }}
          >
            {formatDate(ts)}
          </button>
          <button
            type="button"
            className={`field ${styles.pickerBtn}`}
            onClick={async () => {
              const { ts: picked } = await pickTimeNative(ts)
              if (picked != null) applyTime(formatTime(picked))
            }}
          >
            {formatTime(ts)}
          </button>
        </div>
      ) : (
        <div className={styles.dtRow}>
          <input
            type="date"
            className="field"
            value={formatDate(ts)}
            onChange={(e) => applyDate(e.target.value)}
          />
          <input
            type="time"
            className="field"
            value={formatTime(ts)}
            onChange={(e) => applyTime(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

export function SessionEditSheet({
  open,
  onClose,
  mode,
  session,
  defaultProjectId,
  onSaved,
}: SessionEditSheetProps) {
  const isEdit = mode === 'edit'
  const [projects, setProjects] = useState<Project[]>([])
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [projectId, setProjectId] = useState('')
  const [artworkId, setArtworkId] = useState('')
  const [startTs, setStartTs] = useState(0)
  const [endTs, setEndTs] = useState(0)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [overlapCount, setOverlapCount] = useState(0)
  const [confirmOverlap, setConfirmOverlap] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 打开时按模式初始化表单
  useEffect(() => {
    if (!open) return
    const now = Date.now()
    setProjectId(isEdit && session ? session.projectId : (defaultProjectId ?? ''))
    setArtworkId(isEdit && session ? (session.artworkId ?? '') : '')
    setStartTs(isEdit && session ? session.startedAt : now - 25 * 60 * 1000)
    setEndTs(isEdit && session ? (session.endedAt ?? now) : now)
    setNote(isEdit && session ? session.note : '')
    setError(null)
    setOverlapCount(0)
    setConfirmOverlap(false)
  }, [open, isEdit, session, defaultProjectId])

  // 打开时加载项目与画作选项
  useEffect(() => {
    if (!open) return
    let alive = true
    Promise.all([listProjects(), listArtworks()]).then(([ps, as]) => {
      if (!alive) return
      setProjects(ps)
      setArtworks(as)
    })
    return () => {
      alive = false
    }
  }, [open])

  // create 模式：预选项目无效（如已删除）时回退到第一个项目
  useEffect(() => {
    if (!open || isEdit || projects.length === 0) return
    if (!projects.some((p) => p.id === projectId)) {
      setProjectId(projects[0]?.id ?? '')
    }
  }, [open, isEdit, projects, projectId])

  // edit 模式下原项目可能已被删除，保留一个占位选项
  const projectMissing =
    projectId !== '' && !projects.some((p) => p.id === projectId)

  const touchTimes = () => {
    setError(null)
    setOverlapCount(0)
    setConfirmOverlap(false)
  }

  const handleSave = async () => {
    if (saving) return
    if (!projectId) {
      setError('请选择项目')
      return
    }
    if (endTs <= startTs) {
      setError('结束时间必须晚于开始时间')
      return
    }
    if (endTs > Date.now()) {
      setError('不能创建未来时间的记录')
      return
    }
    const overlaps = await findOverlappingSessions(startTs, endTs, session?.id)
    if (overlaps.length > 0 && !confirmOverlap) {
      setOverlapCount(overlaps.length)
      setError(null)
      return
    }
    setSaving(true)
    try {
      const effectiveSeconds = Math.round((endTs - startTs) / 1000)
      const plannedSeconds =
        isEdit && session ? session.plannedSeconds : effectiveSeconds
      const completionRate =
        plannedSeconds > 0 ? Math.min(1, effectiveSeconds / plannedSeconds) : 0
      const newArtworkId = artworkId || null
      const affected: string[] = []
      if (isEdit && session) {
        await updateSession(session.id, {
          projectId,
          artworkId: newArtworkId,
          plannedSeconds,
          startedAt: startTs,
          endedAt: endTs,
          effectiveSeconds,
          completionRate,
          note: note.trim(),
          isEdited: true,
        })
        if (session.artworkId) affected.push(session.artworkId)
      } else {
        await insertSession({
          projectId,
          artworkId: newArtworkId,
          timerMode: 'countdown',
          plannedSeconds,
          startedAt: startTs,
          endedAt: endTs,
          effectiveSeconds,
          pausedSeconds: 0,
          completionRate,
          status: 'completed',
          note: note.trim(),
          isManual: true,
          isEdited: false,
        })
      }
      if (newArtworkId && !affected.includes(newArtworkId)) {
        affected.push(newArtworkId)
      }
      // 重算所有受影响画作的累计进度
      for (const aid of affected) {
        const total = await sumEffectiveSecondsByArtwork(aid)
        await recomputeArtworkAccumulation(aid, total)
      }
      onSaved()
      onClose()
    } catch {
      setError('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!session) return
    await deleteSession(session.id)
    if (session.artworkId) {
      const total = await sumEffectiveSecondsByArtwork(session.artworkId)
      await recomputeArtworkAccumulation(session.artworkId, total)
    }
    setConfirmDelete(false)
    onSaved()
    onClose()
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={isEdit ? '编辑记录' : '补记专注记录'}
      >
        <div className={styles.form}>
          <div className={styles.group}>
            <span className={styles.groupLabel}>项目</span>
            <select
              className="field"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projectId === '' && <option value="">请选择项目</option>}
              {projectMissing && (
                <option value={projectId} disabled>
                  已删除项目
                </option>
              )}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <DateTimeFields
            label="开始时间"
            ts={startTs}
            onChange={(ts) => {
              setStartTs(ts)
              touchTimes()
            }}
          />
          <DateTimeFields
            label="结束时间"
            ts={endTs}
            onChange={(ts) => {
              setEndTs(ts)
              touchTimes()
            }}
          />

          <div className={styles.group}>
            <span className={styles.groupLabel}>关联画作（可选）</span>
            <select
              className="field"
              value={artworkId}
              onChange={(e) => setArtworkId(e.target.value)}
            >
              <option value="">不关联</option>
              {artworks.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.artist ? ` · ${a.artist}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.group}>
            <span className={styles.groupLabel}>备注</span>
            <textarea
              className="field"
              placeholder="想说点什么？（可选）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          {overlapCount > 0 && (
            <div className={styles.warn}>
              <span>与 {overlapCount} 条已有记录时间重叠</span>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={confirmOverlap}
                  onChange={(e) => setConfirmOverlap(e.target.checked)}
                />
                我已确认时间无误
              </label>
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={`btn-primary ${styles.fullBtn}`}
              disabled={saving}
              onClick={handleSave}
            >
              保存
            </button>
            {isEdit && (
              <button
                className="btn-ghost btn-danger"
                onClick={() => setConfirmDelete(true)}
              >
                删除这条记录
              </button>
            )}
          </div>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        title="删除这条记录"
        message="删除后对应画作的累计进度会同步回收，确定删除？"
        confirmLabel="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
