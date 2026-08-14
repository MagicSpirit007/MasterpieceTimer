/**
 * 沉浸式专注页。
 * 画作是绝对主角；时钟两侧常驻结束 / 暂停。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Artwork, FocusSession, Project } from '../types/models'
import { getArtwork } from '../db/repositories/artworks'
import { getProject } from '../db/repositories/projects'
import { updateSession } from '../db/repositories/sessions'
import { useFocusTimer, deriveFocusDisplay } from '../timer/useFocusTimer'
import { focusController } from '../timer/focusController'
import { ArtworkReveal } from '../components/ArtworkReveal'
import { Sheet, ConfirmSheet } from '../components/ui'
import { useImageSrc } from '../hooks/useImageSrc'
import { applyPalette, derivePalette, resetPalette } from '../services/color'
import { applyCanvas, resolveCanvasId, DEFAULT_CANVAS_ID } from '../services/canvasCatalog'
import { applyCanvasSetting, loadSettings } from '../services/settings'
import { formatClock, formatDateTime, formatDuration } from '../utils/format'
import styles from './FocusPage.module.css'

export function FocusPage() {
  const navigate = useNavigate()
  const [finished, setFinished] = useState<FocusSession | null>(null)
  const finishingRef = useRef(false)

  const completeSession = useCallback(async (status: 'completed' | 'interrupted') => {
    finishingRef.current = true
    const s = await focusController.finish(status, '')
    if (s) setFinished(s)
    else finishingRef.current = false
    return s
  }, [])

  const onAutoComplete = useCallback(() => {
    void completeSession('completed')
  }, [completeSession])
  const { snapshot, now } = useFocusTimer(onAutoComplete)

  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [project, setProject] = useState<Project | null>(null)

  useEffect(() => {
    if (!snapshot) return
    void getArtwork(snapshot.artworkId).then(setArtwork)
    void getProject(snapshot.projectId).then(setProject)
  }, [snapshot?.artworkId, snapshot?.projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!snapshot && !finished && !finishingRef.current) {
      navigate('/', { replace: true })
    }
  }, [snapshot, finished, navigate])

  useEffect(() => {
    if (!artwork) return
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    applyPalette(derivePalette(artwork.dominantColor, theme))
    applyCanvas(resolveCanvasId(artwork.canvasId, DEFAULT_CANVAS_ID))
    return () => {
      resetPalette()
      void loadSettings().then((s) => applyCanvasSetting(s.canvasId))
    }
  }, [artwork])

  const display = snapshot ? deriveFocusDisplay(snapshot, now) : null
  const src = useImageSrc(artwork?.originalImageUri)
  const [viewMode, setViewMode] = useState<'fit' | 'overview'>('fit')

  const [endSheetOpen, setEndSheetOpen] = useState(false)
  const [discardConfirm, setDiscardConfirm] = useState(false)

  if (!snapshot && !finished) return null

  if (!snapshot || !display) {
    return (
      <div className={styles.page}>
        {finished && (
          <SummarySheet
            session={finished}
            artwork={artwork}
            project={project}
            artSrc={src}
            onClose={() => navigate('/')}
          />
        )}
      </div>
    )
  }

  const clockText =
    snapshot.timerMode === 'countdown'
      ? formatClock(display.remainingSeconds)
      : formatClock(display.effectiveSeconds)

  const saveAndFinish = async () => {
    setEndSheetOpen(false)
    await completeSession('interrupted')
  }

  const parkForLater = async () => {
    await focusController.pause()
    setEndSheetOpen(false)
    navigate('/')
  }

  return (
    <div className={styles.page}>
      <div className={styles.stage}>
        {src && artwork && (
          <ArtworkReveal
            src={src}
            aspectRatio={artwork.aspectRatio}
            progress={display.progress}
            alt={artwork.title}
            displayMode={artwork.displayMode}
            viewMode={viewMode}
            onToggleView={() =>
              setViewMode((m) => (m === 'fit' ? 'overview' : 'fit'))
            }
          />
        )}
      </div>

      <div className={styles.info}>
        <div className={styles.clockRow}>
          <button
            className={`${styles.clockBtn} glass`}
            aria-label="提前结束"
            onClick={() => setEndSheetOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
          <div className={styles.clock} data-paused={display.isPaused} aria-live="off">
            {clockText}
          </div>
          <button
            className={`${styles.clockBtn} ${styles.clockBtnMain} glass`}
            aria-label={display.isPaused ? '继续' : '暂停'}
            onClick={() =>
              void (display.isPaused ? focusController.resume() : focusController.pause())
            }
          >
            {display.isPaused ? (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1.2" />
                <rect x="14" y="5" width="4" height="14" rx="1.2" />
              </svg>
            )}
          </button>
        </div>
        {snapshot.timerMode === 'countup' && display.overtimeSeconds > 0 && (
          <div className={styles.overtime}>
            已超出计划 {formatClock(display.overtimeSeconds)}
          </div>
        )}
        {display.isPaused && (
          <div>
            <span className={styles.pausedHint} role="status">
              已暂停 · 暂停 {formatDuration(display.pausedSeconds)}
            </span>
          </div>
        )}
        <div className={styles.artCaption}>
          {artwork ? `${artwork.title} · ${artwork.artist}` : ''}
          <span className={styles.viewHint}>
            {viewMode === 'fit' ? '适配 · 轻点全览' : '全览 · 轻点适配'}
          </span>
        </div>
      </div>

      <Sheet open={endSheetOpen} onClose={() => setEndSheetOpen(false)} title="结束本次专注？">
        <p className="t2 small" style={{ marginBottom: 16 }}>
          已有效专注 {formatDuration(display.effectiveSeconds)}（计划 {formatDuration(snapshot.plannedSeconds)}）
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn-primary" onClick={() => void saveAndFinish()}>
            保存记录并总结
          </button>
          <button className="btn-ghost" onClick={() => void parkForLater()}>
            稍后继续本幅
          </button>
          <button className="btn-ghost btn-danger" onClick={() => setDiscardConfirm(true)}>
            放弃本次记录
          </button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={discardConfirm}
        title="放弃本次记录？"
        message="本次已积累的有效专注时长将不会被保存，此操作不可撤销。"
        confirmLabel="放弃记录"
        danger
        onConfirm={() => {
          setDiscardConfirm(false)
          setEndSheetOpen(false)
          void focusController.discard().then(() => navigate('/'))
        }}
        onCancel={() => setDiscardConfirm(false)}
      />

      {finished && (
        <SummarySheet
          session={finished}
          artwork={artwork}
          project={project}
          artSrc={src}
          onClose={() => navigate('/')}
        />
      )}
    </div>
  )
}

function SummarySheet({
  session,
  artwork,
  project,
  artSrc,
  onClose,
}: {
  session: FocusSession
  artwork: Artwork | null
  project: Project | null
  artSrc: string
  onClose: () => void
}) {
  const [note, setNote] = useState(session.note)
  const pct = Math.round(session.completionRate * 100)

  const save = async () => {
    if (note !== session.note) {
      await updateSession(session.id, { note })
    }
    onClose()
  }

  return (
    <Sheet open onClose={() => void save()} title="本次专注总结">
      <div className={styles.summaryArt}>
        {artSrc && artwork && (
          <ArtworkReveal
            src={artSrc}
            aspectRatio={artwork.aspectRatio}
            progress={session.completionRate}
            alt={artwork.title}
            rounded={false}
            displayMode={artwork.displayMode}
          />
        )}
      </div>
      <div className={styles.summaryGrid}>
        <Item label="项目" value={project?.name ?? '已删除项目'} />
        <Item label="完成比例" value={`${pct}%`} />
        <Item label="计划时长" value={formatDuration(session.plannedSeconds)} />
        <Item label="有效专注" value={formatDuration(session.effectiveSeconds)} />
        <Item label="暂停时长" value={formatDuration(session.pausedSeconds)} />
        <Item
          label="起止时间"
          value={`${formatDateTime(session.startedAt).slice(11)} — ${formatDateTime(session.endedAt ?? Date.now()).slice(11)}`}
        />
      </div>
      <p className="t3 xs" style={{ marginBottom: 8 }}>
        开始于 {formatDateTime(session.startedAt)}
        {session.status === 'completed' ? ' · 已达成计划' : ' · 提前结束'}
      </p>
      <textarea
        className="field"
        placeholder="记录本次专注（可选）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => void save()}>
        完成
      </button>
    </Sheet>
  )
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.summaryItem}>
      <div className={styles.summaryValue}>{value}</div>
      <div className={styles.summaryLabel}>{label}</div>
    </div>
  )
}
