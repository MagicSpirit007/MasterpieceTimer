/** 首页：项目列表（含编辑模式）+ 最近专注记录 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Artwork, FocusSession, Project } from '../types/models'
import {
  createProject,
  deleteProject,
  listProjects,
  moveProject,
  setProjectArchived,
} from '../db/repositories/projects'
import { listRecentSessions } from '../db/repositories/sessions'
import { getArtwork } from '../db/repositories/artworks'
import { useDataVersion } from '../db/events'
import { useFocusTimer, deriveFocusDisplay } from '../timer/useFocusTimer'
import { useImageSrc } from '../hooks/useImageSrc'
import { ConfirmSheet, Sheet } from '../components/ui'
import { SessionEditSheet } from '../components/SessionEditSheet'
import { poemForDay } from '../services/poems'
import {
  formatClock,
  formatDateShort,
  formatDateTime,
  formatDuration,
  startOfDay,
} from '../utils/format'
import ui from '../components/ui.module.css'
import styles from './HomePage.module.css'

type SheetState =
  | { mode: 'create'; defaultProjectId?: string }
  | { mode: 'edit'; session: FocusSession }
  | null

export function HomePage() {
  const navigate = useNavigate()
  const version = useDataVersion()
  const { snapshot, now } = useFocusTimer()
  const [tick, setTick] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [sessions, setSessions] = useState<FocusSession[]>([])
  const [liveArt, setLiveArt] = useState<Artwork | null>(null)
  const [editing, setEditing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirm, setConfirm] = useState<{
    kind: 'archive' | 'delete'
    project: Project
  } | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)


  useEffect(() => {
    let alive = true
    Promise.all([listProjects(), listRecentSessions(500)]).then(([ps, ss]) => {
      if (!alive) return
      setProjects(ps)
      setSessions(ss)
    })
    return () => {
      alive = false
    }
  }, [version, tick])

  useEffect(() => {
    if (!snapshot) {
      setLiveArt(null)
      return
    }
    void getArtwork(snapshot.artworkId).then(setLiveArt)
  }, [snapshot?.artworkId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 每个项目的今日专注时长与最近一次专注时间（记录按开始时间倒序，基本不跨日）
  const stats = new Map<string, { today: number; last: number | null }>()
  const dayStart = startOfDay(Date.now())
  for (const p of projects) stats.set(p.id, { today: 0, last: null })
  for (const s of sessions) {
    const e = stats.get(s.projectId)
    if (!e) continue
    if (s.startedAt >= dayStart) e.today += s.effectiveSeconds
    if (e.last == null || s.startedAt > e.last) e.last = s.startedAt
  }

  const projectName = (id: string) =>
    projects.find((p) => p.id === id)?.name ?? '已删除项目'
  const recent = sessions.slice(0, 10)
  const todayTotal = sessions.reduce(
    (sum, s) => (s.startedAt >= dayStart ? sum + s.effectiveSeconds : sum),
    0,
  )

  const sessionRow = (s: FocusSession) => (
    <div className={ui.listRow}>
      <div className={styles.rowMain}>
        <div className={styles.rowTitle}>
          <span>{projectName(s.projectId)}</span>
          {s.isManual && <span className={styles.badge}>补记</span>}
          {s.isEdited && <span className={styles.badge}>已编辑</span>}
        </div>
        <span className="xs t3">{formatDateTime(s.startedAt)}</span>
      </div>
      <span className="small t2">{formatDuration(s.effectiveSeconds)}</span>
    </div>
  )

  const liveDisplay = snapshot ? deriveFocusDisplay(snapshot, now) : null
  const liveProject = snapshot
    ? projects.find((p) => p.id === snapshot.projectId)
    : null
  const liveClock = liveDisplay
    ? snapshot?.timerMode === 'countdown'
      ? formatClock(liveDisplay.remainingSeconds)
      : formatClock(liveDisplay.effectiveSeconds)
    : ''

  return (
    <div className={`page ${snapshot ? styles.hasNow : ''}`}>
      <div className={styles.header}>
        <div>
          <p className={styles.greet}>
            {snapshot
              ? '有一次专注进行中'
              : todayTotal > 0
                ? `今日已专注 ${formatDuration(todayTotal)}`
                : poemForDay().text}
          </p>
          {!snapshot && todayTotal === 0 && (
            <p className={styles.poemFrom}>{poemForDay().from}</p>
          )}
          <h1 className="page-title">绘梦</h1>
        </div>
        <div className={styles.headerActions}>
          {projects.length > 0 && (
            <button
              className={styles.textBtn}
              onClick={() => setEditing((e) => !e)}
            >
              {editing ? '完成' : '编辑'}
            </button>
          )}
          <button
            className={`btn-ghost ${styles.smallBtn}`}
            onClick={() => setCreateOpen(true)}
          >
            ＋ 新建项目
          </button>
        </div>
      </div>

      <div className="page-scroll">
        {projects.length === 0 ? (
          <div className={ui.empty}>
            <p>创建一个专注项目，开始你的第一次上色</p>
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              新建项目
            </button>
          </div>
        ) : (
          <div className="card">
            {projects.map((p, i) => {
              const st = stats.get(p.id)
              return (
                <div
                  key={p.id}
                  className={`${ui.listRow} ${styles.projRow}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!editing) navigate(`/project/${p.id}`)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !editing) {
                      navigate(`/project/${p.id}`)
                    }
                  }}
                >
                  <div className={styles.rowMain}>
                    <span className={styles.projName}>{p.name}</span>
                    <span className="xs t3">
                      {st && st.today > 0
                        ? `今天 ${formatDuration(st.today)}`
                        : '今天还没开始'}
                      {st?.last != null
                        ? ` · 上次 ${formatDateShort(st.last)}`
                        : ''}
                    </span>
                  </div>
                  {editing ? (
                    <div
                      className={styles.editActions}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className={styles.editBtn}
                        disabled={i === 0}
                        onClick={() => moveProject(p.id, -1)}
                      >
                        上移
                      </button>
                      <button
                        className={styles.editBtn}
                        disabled={i === projects.length - 1}
                        onClick={() => moveProject(p.id, 1)}
                      >
                        下移
                      </button>
                      <button
                        className={styles.editBtn}
                        onClick={() =>
                          setConfirm({ kind: 'archive', project: p })
                        }
                      >
                        归档
                      </button>
                      <button
                        className={`${styles.editBtn} ${styles.editBtnDanger}`}
                        onClick={() =>
                          setConfirm({ kind: 'delete', project: p })
                        }
                      >
                        删除
                      </button>
                    </div>
                  ) : (
                    <button
                      className={styles.startBtn}
                      aria-label={`开始 ${p.name}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/setup?project=${p.id}`)
                      }}
                    >
                      ▶
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {recent.length > 0 && (
          <>
            <p className="section-label">最近记录</p>
            <div className={`card ${styles.sessionList}`}>
              {recent.map((s) => (
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
          </>
        )}
      </div>

      {/* 新建项目 */}
      <Sheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="新建项目"
      >
        <div className={styles.sheetForm}>
          <input
            className="field"
            placeholder="项目名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            className={`btn-primary ${styles.fullBtn}`}
            disabled={!newName.trim()}
            onClick={async () => {
              await createProject({ name: newName })
              setNewName('')
              setCreateOpen(false)
            }}
          >
            创建
          </button>
        </div>
      </Sheet>

      {/* 归档 / 删除确认 */}
      <ConfirmSheet
        open={confirm?.kind === 'archive'}
        title="归档项目"
        message="归档后不再出现在首页，历史记录保留"
        confirmLabel="归档"
        onConfirm={async () => {
          if (confirm) await setProjectArchived(confirm.project.id, true)
          setConfirm(null)
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm?.kind === 'delete'}
        title="删除项目"
        message="删除项目不会删除历史专注记录，确定删除？"
        confirmLabel="删除"
        danger
        onConfirm={async () => {
          if (confirm) await deleteProject(confirm.project.id)
          setConfirm(null)
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

      {snapshot && liveDisplay && (
        <button
          className={styles.nowBar}
          onClick={() => navigate('/focus')}
          aria-label="继续当前专注"
        >
          <NowThumb uri={liveArt?.thumbnailUri} />
          <div className={styles.nowMain}>
            <div className={styles.nowTitle}>
              {liveProject?.name ?? '专注中'}
              {liveDisplay.isPaused ? ' · 已暂停' : ''}
            </div>
            <div className={styles.nowSub}>
              {liveArt ? `${liveArt.title} · ${liveArt.artist}` : '继续上色'}
            </div>
          </div>
          <span className={styles.nowClock}>{liveClock}</span>
        </button>
      )}
    </div>
  )
}

function NowThumb({ uri }: { uri?: string }) {
  const src = useImageSrc(uri)
  return src ? (
    <img className={styles.nowThumb} src={src} alt="" />
  ) : (
    <span className={styles.nowThumb} />
  )
}
