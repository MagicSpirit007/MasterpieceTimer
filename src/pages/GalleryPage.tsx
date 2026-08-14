/**
 * 展览：只收入已完全上色的画作。
 * 英雄区参考内容主导的专辑页层级（全幅画作、叠字标题、一主两次按钮），
 * 但不复制播放器语义。
 */
import { useEffect, useMemo, useState } from 'react'
import type { Artwork, FocusSession, Project } from '../types/models'
import { listArtworks } from '../db/repositories/artworks'
import { listProjects } from '../db/repositories/projects'
import { listSessionsByArtwork } from '../db/repositories/sessions'
import { useDataVersion } from '../db/events'
import { useImageSrc } from '../hooks/useImageSrc'
import { applyPalette, derivePalette, resetPalette } from '../services/color'
import { ArtworkReveal } from '../components/ArtworkReveal'
import { Sheet } from '../components/ui'
import { formatDate, formatDuration } from '../utils/format'
import styles from './GalleryPage.module.css'

type SortKey = 'recent' | 'oldest'

export function GalleryPage() {
  const version = useDataVersion()
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [featuredId, setFeaturedId] = useState<string | null>(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [sort, setSort] = useState<SortKey>('recent')
  const [projectFilter, setProjectFilter] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void Promise.all([listArtworks(), listProjects(true)]).then(([as, ps]) => {
      if (!alive) return
      setArtworks(as)
      setProjects(ps)
    })
    return () => {
      alive = false
    }
  }, [version])

  const completed = useMemo(() => {
    const list = artworks.filter((a) => a.completionStatus === 'completed')
    list.sort((a, b) => {
      const ta = a.completedAt ?? 0
      const tb = b.completedAt ?? 0
      return sort === 'recent' ? tb - ta : ta - tb
    })
    return list
  }, [artworks, sort])

  const [sessionMap, setSessionMap] = useState<Record<string, FocusSession[]>>({})

  useEffect(() => {
    let alive = true
    void Promise.all(completed.map((a) => listSessionsByArtwork(a.id))).then((lists) => {
      if (!alive) return
      const next: Record<string, FocusSession[]> = {}
      completed.forEach((a, i) => {
        next[a.id] = lists[i] ?? []
      })
      setSessionMap(next)
    })
    return () => {
      alive = false
    }
  }, [completed])

  const visible = useMemo(() => {
    if (!projectFilter) return completed
    return completed.filter((a) =>
      (sessionMap[a.id] ?? []).some((s) => s.projectId === projectFilter),
    )
  }, [completed, projectFilter, sessionMap])

  const featured = visible.find((a) => a.id === featuredId) ?? visible[0] ?? null

  useEffect(() => {
    if (featured && featuredId !== featured.id) setFeaturedId(featured.id)
    if (!featured && featuredId) setFeaturedId(null)
  }, [featured, featuredId])

  useEffect(() => {
    if (!featured) {
      resetPalette()
      return
    }
    const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
    applyPalette(derivePalette(featured.dominantColor, theme))
    return () => resetPalette()
  }, [featured])

  const relatedProjects = useMemo(() => {
    const sessions = featured ? (sessionMap[featured.id] ?? []) : []
    const ids = [...new Set(sessions.map((s) => s.projectId))]
    return ids.map((id) => projects.find((p) => p.id === id)?.name ?? '已删除项目')
  }, [featured, sessionMap, projects])

  const heroSrc = useImageSrc(featured?.originalImageUri)

  return (
    <div className={styles.page}>
      {featured ? (
        <>
          <section className={styles.hero} aria-label="展览主视觉">
            {heroSrc && (
              <img className={styles.heroImg} src={heroSrc} alt={featured.title} />
            )}
            <div className={styles.heroShade} />
            <div className={styles.heroCopy}>
              <h1 className={styles.heroTitle}>{featured.title}</h1>
              <p className={styles.heroSub}>{featured.artist || '佚名'}</p>
              <p className={styles.heroMeta}>
                {featured.completedAt ? `${formatDate(featured.completedAt)} 完成` : '已完成'}
                {' · '}
                累计 {formatDuration(featured.accumulatedFocusSeconds)}
              </p>
            </div>
          </section>

          <div className={styles.actions}>
            <button
              className={styles.circleBtn}
              aria-label="筛选"
              onClick={() => setFilterOpen(true)}
            >
              <FilterIcon />
            </button>
            <button className={styles.primaryBtn} onClick={() => setLightbox(true)}>
              查看大图
            </button>
            <button
              className={styles.circleBtn}
              aria-label="作品信息"
              onClick={() => setInfoOpen(true)}
            >
              <InfoIcon />
            </button>
          </div>

          {(featured.source || featured.licenseNote || featured.note) && (
            <p className={styles.blurb}>
              {[featured.note, featured.source, featured.licenseNote]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}

          {visible.length > 1 && (
            <>
              <p className={styles.section}>藏品</p>
              <div className={styles.rail} role="list">
                {visible.map((a) => (
                  <button
                    key={a.id}
                    className={styles.railItem}
                    data-active={a.id === featured.id}
                    onClick={() => setFeaturedId(a.id)}
                    role="listitem"
                  >
                    <RailThumb artwork={a} />
                    <span className={styles.railTitle}>{a.title}</span>
                    <span className={styles.railSub}>{a.artist || '佚名'}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className={styles.empty}>
          <h1 className="page-title" style={{ paddingLeft: 0 }}>
            展览
          </h1>
          <p>还没有完全上色的画作。完成一次计划专注，它就会成为藏品。</p>
        </div>
      )}

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="筛选">
        <p className="section-label" style={{ marginTop: 0 }}>
          排序
        </p>
        <div className={styles.chipRow}>
          <button
            className={styles.chip}
            data-active={sort === 'recent'}
            onClick={() => setSort('recent')}
          >
            最近完成
          </button>
          <button
            className={styles.chip}
            data-active={sort === 'oldest'}
            onClick={() => setSort('oldest')}
          >
            最早完成
          </button>
        </div>
        <p className="section-label">关联项目</p>
        <div className={styles.chipRow}>
          <button
            className={styles.chip}
            data-active={projectFilter == null}
            onClick={() => setProjectFilter(null)}
          >
            全部
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              className={styles.chip}
              data-active={projectFilter === p.id}
              onClick={() => setProjectFilter(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button
          className="btn-primary"
          style={{ width: '100%', marginTop: 20 }}
          onClick={() => setFilterOpen(false)}
        >
          完成
        </button>
      </Sheet>

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title={featured?.title}>
        {featured && (
          <div className={styles.infoBody}>
            <p>
              <span className="t3">作者</span>
              <br />
              {featured.artist || '佚名'}
            </p>
            <p>
              <span className="t3">来源</span>
              <br />
              {featured.source || '未填写'}
            </p>
            <p>
              <span className="t3">版权 / 授权</span>
              <br />
              {featured.licenseNote || '未填写'}
            </p>
            <p>
              <span className="t3">完成日期</span>
              <br />
              {featured.completedAt ? formatDate(featured.completedAt) : '—'}
            </p>
            <p>
              <span className="t3">累计专注</span>
              <br />
              {formatDuration(featured.accumulatedFocusSeconds)}
            </p>
            <p>
              <span className="t3">关联项目</span>
              <br />
              {relatedProjects.length > 0 ? relatedProjects.join('、') : '—'}
            </p>
          </div>
        )}
      </Sheet>

      {lightbox && featured && (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label={featured.title}
          onClick={() => setLightbox(false)}
        >
          <div className={styles.lightboxStage} onClick={(e) => e.stopPropagation()}>
            {heroSrc && (
              <ArtworkReveal
                src={heroSrc}
                aspectRatio={featured.aspectRatio}
                progress={1}
                alt={featured.title}
                rounded={false}
                displayMode={featured.displayMode}
              />
            )}
          </div>
          <button className={styles.lightboxClose} onClick={() => setLightbox(false)}>
            关闭
          </button>
        </div>
      )}
    </div>
  )
}

function RailThumb({ artwork }: { artwork: Artwork }) {
  const src = useImageSrc(artwork.thumbnailUri)
  return src ? (
    <img className={styles.thumb} src={src} alt="" />
  ) : (
    <div className={styles.thumb} />
  )
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 8h.01" strokeLinecap="round" />
    </svg>
  )
}
