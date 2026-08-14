/**
 * 画作管理：导入（相册/文件）、元信息编辑、删除。
 * 导入的图片复制到应用私有目录，提取主题色与宽高比后入库；
 * 元信息表单允许填写名称、作者、来源、版权/授权与备注。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Artwork } from '../types/models'
import {
  createArtwork,
  deleteArtwork,
  listArtworks,
  updateArtworkMeta,
} from '../db/repositories/artworks'
import {
  deleteArtworkFiles,
  pickImageFromGallery,
  pickImageViaInput,
  saveImportedImage,
  subscribeRestoredImage,
  takePendingRestoredImage,
} from '../services/artworkStorage'
import { extractDominantColor, derivePalette } from '../services/color'
import { CANVAS_CATALOG, DEFAULT_CANVAS_ID, resolveCanvasId } from '../services/canvasCatalog'
import { loadSettings } from '../services/settings'
import { resolveImageSrc } from '../services/artworkStorage'
import { useDataVersion } from '../db/events'
import { useImageSrc } from '../hooks/useImageSrc'
import { Sheet, ConfirmSheet } from '../components/ui'
import { formatDuration, newId } from '../utils/format'
import styles from './ArtworksPage.module.css'

export function ArtworksPage() {
  const navigate = useNavigate()
  const version = useDataVersion('artworks')
  const [artworks, setArtworks] = useState<Artwork[]>([])
  const [editing, setEditing] = useState<Artwork | null>(null)
  const [deleting, setDeleting] = useState<Artwork | null>(null)
  /** 刚导入、等待补全元信息的图片 */
  const [pendingImport, setPendingImport] = useState<{
    blob: Blob
    previewUrl: string
  } | null>(null)

  useEffect(() => {
    void listArtworks().then(setArtworks)
  }, [version])

  useEffect(() => {
    const pending = takePendingRestoredImage()
    if (pending) importBlob(pending)
    return subscribeRestoredImage(importBlob)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const importBlob = (blob: Blob | null) => {
    if (!blob) return
    if (!blob.type.startsWith('image/')) return
    setPendingImport({ blob, previewUrl: URL.createObjectURL(blob) })
  }

  return (
    <div className="page">
      <div className="row" style={{ padding: '12px 20px 0' }}>
        <button className="btn-ghost" style={{ minHeight: 36 }} onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
      </div>
      <h1 className="page-title">画作管理</h1>
      <div className="page-scroll">
        <div className={styles.importRow}>
          <button className="btn-ghost" onClick={() => void pickImageFromGallery().then(importBlob)}>
            从相册导入
          </button>
          <button className="btn-ghost" onClick={() => void pickImageViaInput().then(importBlob)}>
            从文件导入
          </button>
        </div>

        {artworks.length === 0 ? (
          <div className="empty" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 12, padding: '40px 24px', color: 'var(--text-3)', textAlign: 'center',
          }}>
            还没有画作。导入一幅喜欢的作品，让专注为它上色。
          </div>
        ) : (
          <div className={styles.grid}>
            {artworks.map((a) => (
              <ArtworkTile key={a.id} artwork={a} onClick={() => setEditing(a)} />
            ))}
          </div>
        )}
      </div>

      {pendingImport && (
        <ImportForm
          blob={pendingImport.blob}
          previewUrl={pendingImport.previewUrl}
          onDone={() => setPendingImport(null)}
        />
      )}

      {editing && (
        <EditForm
          artwork={editing}
          onClose={() => setEditing(null)}
          onDelete={() => {
            setDeleting(editing)
            setEditing(null)
          }}
        />
      )}

      <ConfirmSheet
        open={!!deleting}
        title={`删除「${deleting?.title ?? ''}」？`}
        message="将同时删除画作文件；关联的专注记录会保留，但不再关联该画作。"
        confirmLabel="删除画作"
        danger
        onConfirm={() => {
          const a = deleting
          setDeleting(null)
          if (!a) return
          void (async () => {
            if (!a.isPreset) {
              await deleteArtworkFiles(a.originalImageUri, a.thumbnailUri)
            }
            await deleteArtwork(a.id)
          })()
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function ArtworkTile({ artwork, onClick }: { artwork: Artwork; onClick: () => void }) {
  const src = useImageSrc(artwork.thumbnailUri)
  const pct = Math.min(
    100,
    Math.round((artwork.accumulatedFocusSeconds / Math.max(1, artwork.requiredFocusSeconds)) * 100),
  )
  return (
    <button className={styles.card} onClick={onClick}>
      {src && <img className={styles.thumb} src={src} alt={artwork.title} />}
      <div className={styles.meta}>
        <div className={styles.title}>{artwork.title}</div>
        <div className={styles.sub}>{artwork.artist || '佚名'}</div>
        {artwork.completionStatus === 'completed' ? (
          <span className={styles.badge}>已展出</span>
        ) : (
          <div className={styles.progress}>
            <div className={styles.progressTrack} aria-hidden>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.progressLabel}>已上色 {pct}%</span>
          </div>
        )}
      </div>
    </button>
  )
}

/* ---------- 导入表单 ---------- */

function ImportForm({
  blob,
  previewUrl,
  onDone,
}: {
  blob: Blob
  previewUrl: string
  onDone: () => void
}) {
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [source, setSource] = useState('')
  const [licenseNote, setLicenseNote] = useState('')
  const [note, setNote] = useState('')
  const [canvasId, setCanvasId] = useState(DEFAULT_CANVAS_ID)
  const [coloringMinutes, setColoringMinutes] = useState(45)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadSettings().then((s) => {
      setCanvasId(resolveCanvasId(s.canvasId))
      setColoringMinutes(s.artworkColoringMinutes)
    })
  }, [])

  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const id = newId()
      const stored = await saveImportedImage(id, blob)
      const src = await resolveImageSrc(stored.filePath)
      const dominantColor = await extractDominantColor(src)
      await createArtwork({
        title: title.trim() || '未命名画作',
        artist: artist.trim(),
        source: source.trim(),
        licenseNote: licenseNote.trim(),
        originalImageUri: stored.filePath,
        thumbnailUri: stored.thumbnailPath,
        aspectRatio: stored.aspectRatio,
        orientation: stored.orientation,
        dominantColor,
        requiredFocusSeconds: Math.max(1, coloringMinutes) * 60,
        isPreset: false,
        note: note.trim(),
        canvasId,
        displayMode: stored.aspectRatio > 4 ? 'handscroll' : 'easel',
      })
      onDone()
    } finally {
      setSaving(false)
    }
  }

  const copyrightMissing = !source.trim() && !licenseNote.trim()

  return (
    <Sheet open onClose={onDone} title="导入画作">
      <img className={styles.preview} src={previewUrl} alt="待导入画作预览" />
      {copyrightMissing && (
        <div className={styles.notice}>
          未填写来源或版权信息。个人学习使用不受影响；如计划公开展示，请确认授权。
        </div>
      )}
      <Field label="画作名称">
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：星空" />
      </Field>
      <Field label="作者">
        <input className="field" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="例如：梵高" />
      </Field>
      <Field label="来源">
        <input className="field" value={source} onChange={(e) => setSource(e.target.value)} placeholder="例如：博物馆公开馆藏 / 自摄" />
      </Field>
      <Field label="版权 / 授权信息">
        <input className="field" value={licenseNote} onChange={(e) => setLicenseNote(e.target.value)} placeholder="例如：Public Domain / CC0" />
      </Field>
      <Field label="画布底材">
        <select
          className="field"
          value={canvasId}
          onChange={(e) => setCanvasId(resolveCanvasId(e.target.value))}
        >
          {CANVAS_CATALOG.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="备注">
        <textarea className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <button className="btn-primary" style={{ width: '100%' }} disabled={saving} onClick={() => void save()}>
        {saving ? '保存中…' : '保存画作'}
      </button>
    </Sheet>
  )
}

/* ---------- 编辑表单 ---------- */

function EditForm({
  artwork,
  onClose,
  onDelete,
}: {
  artwork: Artwork
  onClose: () => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(artwork.title)
  const [artist, setArtist] = useState(artwork.artist)
  const [source, setSource] = useState(artwork.source)
  const [licenseNote, setLicenseNote] = useState(artwork.licenseNote)
  const [note, setNote] = useState(artwork.note)
  const [canvasId, setCanvasId] = useState(resolveCanvasId(artwork.canvasId))
  const src = useImageSrc(artwork.originalImageUri)
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  const palette = derivePalette(artwork.dominantColor, theme)

  const save = async () => {
    await updateArtworkMeta(artwork.id, {
      title: title.trim() || artwork.title,
      artist: artist.trim(),
      source: source.trim(),
      licenseNote: licenseNote.trim(),
      note: note.trim(),
      canvasId,
    })
    onClose()
  }

  return (
    <Sheet open onClose={() => void save()} title="画作信息">
      {src && <img className={styles.preview} src={src} alt={artwork.title} />}
      <p className="t3 xs" style={{ marginBottom: 12 }}>
        累计上色 {formatDuration(artwork.accumulatedFocusSeconds)} · 主题色{' '}
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: 5,
            background: palette.tint,
            verticalAlign: 'middle',
          }}
        />{' '}
        {artwork.dominantColor || '中性默认'}
      </p>
      <Field label="画作名称">
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label="作者">
        <input className="field" value={artist} onChange={(e) => setArtist(e.target.value)} />
      </Field>
      <Field label="来源">
        <input className="field" value={source} onChange={(e) => setSource(e.target.value)} />
      </Field>
      <Field label="版权 / 授权信息">
        <input className="field" value={licenseNote} onChange={(e) => setLicenseNote(e.target.value)} />
      </Field>
      <Field label="画布底材">
        <select
          className="field"
          value={canvasId}
          onChange={(e) => setCanvasId(resolveCanvasId(e.target.value))}
        >
          {CANVAS_CATALOG.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="备注">
        <textarea className="field" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <button className="btn-primary" style={{ width: '100%' }} onClick={() => void save()}>
        保存
      </button>
      {!artwork.isPreset && (
        <button
          className="btn-ghost btn-danger"
          style={{ width: '100%', marginTop: 8 }}
          onClick={onDelete}
        >
          删除这幅画
        </button>
      )}
    </Sheet>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.formGroup}>
      <label className={styles.formLabel}>{label}</label>
      {children}
    </div>
  )
}
