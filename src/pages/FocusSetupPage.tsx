/**
 * 专注设置流程：选择项目 → 模式与时长 → 选择画作 → 开始。
 * 单页呈现完整配置，开始前清楚可见，避免误启动；
 * 默认带入上次选择（用户设置中的 last*）。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Artwork, Project, TimerMode } from '../types/models'
import { listProjects, createProject } from '../db/repositories/projects'
import { listArtworks } from '../db/repositories/artworks'
import { loadSettings, saveSettings } from '../services/settings'
import { useDataVersion } from '../db/events'
import { useImageSrc } from '../hooks/useImageSrc'
import { focusController } from '../timer/focusController'
import { DurationPicker, SegmentedControl, Sheet } from '../components/ui'
import type { ActiveSessionSnapshot } from '../types/models'
import { formatDuration } from '../utils/format'
import styles from './FocusSetupPage.module.css'

export function FocusSetupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const version = useDataVersion()

  const [projects, setProjects] = useState<Project[]>([])
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [projectId, setProjectId] = useState<string | null>(null)
  const [artworkId, setArtworkId] = useState<string | null>(null)
  const [mode, setMode] = useState<TimerMode>('countdown')
  const [minutes, setMinutes] = useState(25)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [starting, setStarting] = useState(false)
  const [active, setActive] = useState<ActiveSessionSnapshot | null>(
    () => focusController.getSnapshot(),
  )
  const [replaceOpen, setReplaceOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      const [ps, as, settings] = await Promise.all([
        listProjects(),
        listArtworks(),
        loadSettings(),
      ])
      setProjects(ps)
      setArtworks(as)
      const preselect = params.get('project')
      setProjectId((cur) => {
        if (cur) return cur
        if (preselect && ps.some((p) => p.id === preselect)) return preselect
        if (settings.lastProjectId && ps.some((p) => p.id === settings.lastProjectId))
          return settings.lastProjectId
        return ps[0]?.id ?? null
      })
      setArtworkId((cur) => {
        if (cur) return cur
        if (settings.lastArtworkId && as.some((a) => a.id === settings.lastArtworkId))
          return settings.lastArtworkId
        // 默认选第一张未完成的画作
        return as.find((a) => a.completionStatus === 'in_progress')?.id ?? as[0]?.id ?? null
      })
      setMode(settings.lastTimerMode || settings.defaultTimerMode)
      setMinutes(settings.lastPlannedMinutes || settings.defaultPlannedMinutes)
    })()
  }, [version, params])

  const artwork = useMemo(
    () => artworks.find((a) => a.id === artworkId) ?? null,
    [artworks, artworkId],
  )
  const project = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  const plannedSeconds =
    mode === 'countup'
      ? Math.max(60, artwork?.requiredFocusSeconds ?? minutes * 60)
      : minutes * 60

  const canStart =
    !!project && !!artwork && (mode === 'countup' || minutes >= 1) && !starting

  const begin = async (ifActive?: 'save' | 'discard') => {
    if (!project || !artwork || starting) return
    setStarting(true)
    try {
      await focusController.start(
        {
          projectId: project.id,
          artworkId: artwork.id,
          timerMode: mode,
          plannedSeconds,
        },
        { ifActive },
      )
      await saveSettings({
        lastProjectId: project.id,
        lastArtworkId: artwork.id,
        lastTimerMode: mode,
        lastPlannedMinutes: minutes,
      })
      navigate('/focus')
    } finally {
      setStarting(false)
    }
  }

  const start = async () => {
    if (focusController.getSnapshot()) {
      setActive(focusController.getSnapshot())
      setReplaceOpen(true)
      return
    }
    await begin()
  }

  const addProject = async () => {
    const name = newProjectName.trim()
    if (!name) return
    const p = await createProject({ name })
    setNewProjectOpen(false)
    setNewProjectName('')
    setProjectId(p.id)
  }

  return (
    <div className="page">
      <div className="row" style={{ padding: '12px 20px 0' }}>
        <button className="btn-ghost" style={{ minHeight: 36 }} onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
      </div>
      <h1 className="page-title">准备专注</h1>
      <div className="page-scroll">
        {active && (
          <div className={styles.activeBanner} role="status">
            <div>
              <strong>有未完成的专注</strong>
              <p className="t2 small">开始新的专注将结束当前会话。亦可返回继续上色。</p>
            </div>
            <button className="btn-ghost" style={{ minHeight: 36 }} onClick={() => navigate('/focus')}>
              继续
            </button>
          </div>
        )}
        <div className="section-label">项目</div>
        <div className={styles.projectChips}>
          {projects.map((p) => (
            <button
              key={p.id}
              className="btn-ghost"
              style={
                p.id === projectId
                  ? { background: 'var(--tint-strong)', color: 'var(--tint-contrast)' }
                  : undefined
              }
              onClick={() => setProjectId(p.id)}
            >
              {p.name}
            </button>
          ))}
          <button className="btn-ghost" onClick={() => setNewProjectOpen(true)}>
            ＋ 新建
          </button>
        </div>

        <div className="section-label">计时模式</div>
        <SegmentedControl<TimerMode>
          ariaLabel="计时模式"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'countdown', label: '倒计时' },
            { value: 'countup', label: '正计时' },
          ]}
        />

        {mode === 'countdown' && (
          <>
            <div className="section-label">计划时长</div>
            <DurationPicker minutes={minutes} onChange={setMinutes} />
          </>
        )}

        <div className="section-label">本次上色的画作</div>
        {artworks.length === 0 ? (
          <div className="card" style={{ padding: 20 }}>
            <p className="t2 small">暂无画作。</p>
            <button
              className="btn-ghost"
              style={{ marginTop: 12 }}
              onClick={() => navigate('/artworks')}
            >
              导入画作
            </button>
          </div>
        ) : (
          <div className={styles.artScroll} role="listbox" aria-label="选择画作">
            {artworks.map((a) => (
              <ArtworkCard
                key={a.id}
                artwork={a}
                active={a.id === artworkId}
                onSelect={() => setArtworkId(a.id)}
              />
            ))}
          </div>
        )}

        <div className="section-label">本次配置</div>
        <div className="card" style={{ padding: '8px 16px' }}>
          <div className={styles.summaryRow}>
            <span>项目</span>
            <strong>{project?.name ?? '未选择'}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>模式</span>
            <strong>{mode === 'countdown' ? '倒计时' : '正计时'}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>计划时长</span>
            <strong>
              {mode === 'countup'
                ? `随画卷 · ${formatDuration(plannedSeconds)}`
                : formatDuration(minutes * 60)}
            </strong>
          </div>
          <div className={styles.summaryRow}>
            <span>画作</span>
            <strong>{artwork ? `${artwork.title} · ${artwork.artist}` : '未选择'}</strong>
          </div>
        </div>

        <div className={styles.confirmBar}>
          <button
            className="btn-primary"
            style={{ width: '100%' }}
            disabled={!canStart}
            onClick={() => void start()}
          >
            {starting ? '正在开始…' : '开始专注'}
          </button>
        </div>
      </div>

      <Sheet
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        title="已有进行中的专注"
      >
        <p className="t2 small" style={{ marginBottom: 16 }}>
          开始新的专注将结束当前会话。已累计的有效时长可选择保存或放弃。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn-primary" onClick={() => navigate('/focus')}>
            返回继续
          </button>
          <button
            className="btn-ghost"
            disabled={starting}
            onClick={() => void begin('save')}
          >
            保存并开始新专注
          </button>
          <button
            className="btn-ghost btn-danger"
            disabled={starting}
            onClick={() => void begin('discard')}
          >
            放弃并开始新专注
          </button>
        </div>
      </Sheet>
      <Sheet open={newProjectOpen} onClose={() => setNewProjectOpen(false)} title="新建项目">
        <input
          className="field"
          placeholder="例如：阅读、英语、编程"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          autoFocus
        />
        <button
          className="btn-primary"
          style={{ width: '100%', marginTop: 16 }}
          disabled={!newProjectName.trim()}
          onClick={() => void addProject()}
        >
          创建
        </button>
      </Sheet>
    </div>
  )
}

function ArtworkCard({
  artwork,
  active,
  onSelect,
}: {
  artwork: Artwork
  active: boolean
  onSelect: () => void
}) {
  const src = useImageSrc(artwork.thumbnailUri)
  const pct = Math.min(
    100,
    Math.round((artwork.accumulatedFocusSeconds / Math.max(1, artwork.requiredFocusSeconds)) * 100),
  )
  return (
    <button
      className={styles.artCard}
      data-active={active}
      onClick={onSelect}
      role="option"
      aria-selected={active}
    >
      {src && <img className={styles.artThumb} src={src} alt={artwork.title} />}
      <div className={styles.artMeta}>
        <div className={styles.artTitle}>{artwork.title}</div>
        <div className={styles.artSub}>
          {artwork.completionStatus === 'completed' ? '已完成' : `已上色 ${pct}%`}
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </button>
  )
}
