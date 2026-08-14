/** 项目详情：累计统计 + 全部专注记录 + 项目管理 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { FocusSession, Project } from '../types/models'
import {
  deleteProject,
  getProject,
  renameProject,
  setProjectArchived,
} from '../db/repositories/projects'
import { listSessionsByProject } from '../db/repositories/sessions'
import { useDataVersion } from '../db/events'
import { ConfirmSheet, Sheet } from '../components/ui'
import { SessionEditSheet } from '../components/SessionEditSheet'
import { formatDateTime, formatDuration } from '../utils/format'
import ui from '../components/ui.module.css'
import styles from './ProjectDetailPage.module.css'

type SheetState =
  | { mode: 'create'; defaultProjectId?: string }
  | { mode: 'edit'; session: FocusSession }
  | null

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const version = useDataVersion()
  const [tick, setTick] = useState(0)
  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    Promise.all([getProject(id), listSessionsByProject(id, 500)]).then(
      ([p, ss]) => {
        if (!alive) return
        setProject(p)
        setSessions(ss)
      },
    )
    return () => {
      alive = false
    }
  }, [id, version, tick])

  if (project === undefined) {
    return <div className="page" />
  }

  if (project === null) {
    return (
      <div className="page">
        <div className={ui.empty}>
          <p>项目不存在或已删除</p>
          <button className="btn-ghost" onClick={() => navigate(-1)}>
            返回
          </button>
        </div>
      </div>
    )
  }

  const totalSeconds = sessions.reduce((sum, s) => sum + s.effectiveSeconds, 0)

  const sessionRow = (s: FocusSession) => (
    <div className={ui.listRow}>
      <div className={styles.rowMain}>
        <div className={styles.rowTitle}>
          <span>{project.name}</span>
          {s.isManual && <span className={styles.badge}>补记</span>}
          {s.isEdited && <span className={styles.badge}>已编辑</span>}
        </div>
        <span className="xs t3">{formatDateTime(s.startedAt)}</span>
      </div>
      <span className="small t2">{formatDuration(s.effectiveSeconds)}</span>
    </div>
  )

  return (
    <div className="page">
      <div className={styles.topbar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
      </div>
      <h1 className={`page-title ${styles.title}`}>{project.name}</h1>

      <div className="page-scroll">
        <div className={`card ${styles.statsCard}`}>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {formatDuration(totalSeconds)}
            </span>
            <span className="xs t3">累计专注</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{sessions.length} 次</span>
            <span className="xs t3">专注次数</span>
          </div>
        </div>

        <div className={styles.startWrap}>
          <button
            className={`btn-primary ${styles.fullBtn}`}
            onClick={() => navigate(`/setup?project=${project.id}`)}
          >
            开始专注
          </button>
          <button
            className={`btn-ghost ${styles.fullBtn}`}
            onClick={() =>
              setSheet({ mode: 'create', defaultProjectId: project.id })
            }
          >
            补记时长
          </button>
        </div>

        <p className="section-label">专注记录</p>
        {sessions.length === 0 ? (
          <div className="card">
            <div className={ui.listRow}>
              <span className="small t3">还没有专注记录</span>
            </div>
          </div>
        ) : (
          <div className={`card ${styles.sessionList}`}>
            {sessions.map((s) => (
              <button
                key={s.id}
                type="button"
                className={styles.sessionHit}
                onClick={() => setSheet({ mode: 'edit', session: s })}
              >
                {sessionRow(s)}
              </button>
            ))}
          </div>
        )}

        <p className="section-label">项目管理</p>
        <div className="card">
          <button
            className={`${ui.listRow} ${styles.manageRow}`}
            onClick={() =>
              setSheet({ mode: 'create', defaultProjectId: project.id })
            }
          >
            补记时长
            <span className={`t3 ${styles.chev}`}>›</span>
          </button>
          <button
            className={`${ui.listRow} ${styles.manageRow}`}
            onClick={() => {
              setRenameValue(project.name)
              setRenameOpen(true)
            }}
          >
            重命名
            <span className={`t3 ${styles.chev}`}>›</span>
          </button>
          <button
            className={`${ui.listRow} ${styles.manageRow}`}
            onClick={() => setConfirm('archive')}
          >
            {project.isArchived ? '取消归档' : '归档'}
            <span className={`t3 ${styles.chev}`}>›</span>
          </button>
          <button
            className={`${ui.listRow} ${styles.manageRow} ${styles.dangerText}`}
            onClick={() => setConfirm('delete')}
          >
            删除项目
            <span className={`t3 ${styles.chev}`}>›</span>
          </button>
        </div>
      </div>

      {/* 重命名 */}
      <Sheet
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="重命名项目"
      >
        <div className={styles.sheetForm}>
          <input
            className="field"
            placeholder="项目名称"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
          />
          <button
            className={`btn-primary ${styles.fullBtn}`}
            disabled={!renameValue.trim()}
            onClick={async () => {
              await renameProject(project.id, renameValue)
              setRenameOpen(false)
            }}
          >
            保存
          </button>
        </div>
      </Sheet>

      {/* 归档 / 删除确认 */}
      <ConfirmSheet
        open={confirm === 'archive'}
        title={project.isArchived ? '取消归档' : '归档项目'}
        message={
          project.isArchived
            ? '取消归档后项目会重新出现在首页'
            : '归档后不再出现在首页，历史记录保留'
        }
        confirmLabel={project.isArchived ? '取消归档' : '归档'}
        onConfirm={async () => {
          await setProjectArchived(project.id, !project.isArchived)
          setConfirm(null)
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm === 'delete'}
        title="删除项目"
        message="删除项目不会删除历史专注记录，确定删除？"
        confirmLabel="删除"
        danger
        onConfirm={async () => {
          await deleteProject(project.id)
          setConfirm(null)
          navigate(-1)
        }}
        onCancel={() => setConfirm(null)}
      />

      {/* 补记 / 编辑记录 */}
      <SessionEditSheet
        open={sheet != null}
        onClose={() => setSheet(null)}
        mode={sheet?.mode ?? 'create'}
        session={sheet?.mode === 'edit' ? sheet.session : undefined}
        defaultProjectId={
          sheet?.mode === 'create' ? sheet.defaultProjectId : undefined
        }
        onSaved={() => setTick((t) => t + 1)}
      />
    </div>
  )
}
