import type {
  Artwork,
  ArtworkDisplayMode,
  CompletionStatus,
  Orientation,
} from '../../types/models'
import { query, run, withTransaction } from '../database'
import { emitDataChange } from '../events'
import { newId } from '../../utils/format'

interface ArtworkRow {
  id: string
  title: string
  artist: string
  source: string
  licenseNote: string
  originalImageUri: string
  thumbnailUri: string
  aspectRatio: number
  orientation: Orientation
  dominantColor: string
  requiredFocusSeconds: number
  accumulatedFocusSeconds: number
  completionStatus: CompletionStatus
  completedAt: number | null
  isPreset: number
  note: string
  createdAt: number
  canvasId?: string
  displayMode?: ArtworkDisplayMode
}

function toModel(r: ArtworkRow): Artwork {
  return {
    ...r,
    isPreset: r.isPreset === 1,
    canvasId: r.canvasId || 'oil-linen',
    displayMode: r.displayMode === 'handscroll' ? 'handscroll' : 'easel',
  }
}

export async function listArtworks(): Promise<Artwork[]> {
  const rows = await query<ArtworkRow>(
    'SELECT * FROM artworks ORDER BY createdAt DESC',
  )
  return rows.map(toModel)
}

export async function getArtwork(id: string): Promise<Artwork | null> {
  const rows = await query<ArtworkRow>('SELECT * FROM artworks WHERE id = ?', [id])
  return rows[0] ? toModel(rows[0]) : null
}

/** 按稳定 id 插入内置名画；已存在则只补画布/展示字段，不重置进度 */
export async function ensurePresetArtwork(
  artwork: Omit<Artwork, 'accumulatedFocusSeconds' | 'completionStatus' | 'completedAt' | 'createdAt'>,
): Promise<void> {
  const existing = await getArtwork(artwork.id)
  if (existing) {
    const patch: Partial<Pick<Artwork, 'canvasId' | 'displayMode' | 'originalImageUri' | 'thumbnailUri' | 'aspectRatio' | 'orientation' | 'dominantColor'>> = {}
    if (existing.canvasId !== artwork.canvasId) patch.canvasId = artwork.canvasId
    if (existing.displayMode !== artwork.displayMode) patch.displayMode = artwork.displayMode
    if (existing.isPreset && artwork.originalImageUri.startsWith('preset:')) {
      await run(
        `UPDATE artworks SET originalImageUri = ?, thumbnailUri = ?, aspectRatio = ?, orientation = ?, dominantColor = ?, canvasId = ?, displayMode = ? WHERE id = ?`,
        [
          artwork.originalImageUri,
          artwork.thumbnailUri,
          artwork.aspectRatio,
          artwork.orientation,
          artwork.dominantColor,
          artwork.canvasId,
          artwork.displayMode,
          artwork.id,
        ],
      )
      emitDataChange('artworks')
      return
    }
    if (Object.keys(patch).length > 0) {
      await updateArtworkMeta(artwork.id, patch)
    }
    return
  }
  await createArtwork(artwork)
}

export async function createArtwork(
  input: Omit<Artwork, 'id' | 'accumulatedFocusSeconds' | 'completionStatus' | 'completedAt' | 'createdAt'> & {
    id?: string
  },
): Promise<Artwork> {
  const artwork: Artwork = {
    ...input,
    id: input.id ?? newId(),
    accumulatedFocusSeconds: 0,
    completionStatus: 'in_progress',
    completedAt: null,
    createdAt: Date.now(),
    canvasId: input.canvasId || 'oil-linen',
    displayMode: input.displayMode === 'handscroll' ? 'handscroll' : 'easel',
  }
  await run(
    `INSERT INTO artworks (
      id, title, artist, source, licenseNote, originalImageUri, thumbnailUri,
      aspectRatio, orientation, dominantColor, requiredFocusSeconds,
      accumulatedFocusSeconds, completionStatus, completedAt, isPreset, note, createdAt,
      canvasId, displayMode
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'in_progress', NULL, ?, ?, ?, ?, ?)`,
    [
      artwork.id, artwork.title, artwork.artist, artwork.source, artwork.licenseNote,
      artwork.originalImageUri, artwork.thumbnailUri, artwork.aspectRatio,
      artwork.orientation, artwork.dominantColor, artwork.requiredFocusSeconds,
      artwork.isPreset ? 1 : 0, artwork.note, artwork.createdAt,
      artwork.canvasId, artwork.displayMode,
    ],
  )
  emitDataChange('artworks')
  return artwork
}

export async function updateArtworkMeta(
  id: string,
  patch: Partial<Pick<Artwork, 'title' | 'artist' | 'source' | 'licenseNote' | 'note' | 'requiredFocusSeconds' | 'dominantColor' | 'canvasId' | 'displayMode'>>,
): Promise<void> {
  const keys = Object.keys(patch) as (keyof typeof patch)[]
  if (keys.length === 0) return
  const setSql = keys.map((k) => `${k} = ?`).join(', ')
  await run(`UPDATE artworks SET ${setSql} WHERE id = ?`, [
    ...keys.map((k) => patch[k]),
    id,
  ])
  emitDataChange('artworks')
}

/** 累计专注时长；达到 requiredFocusSeconds 时标记完成（同一画作只保留一件藏品） */
export async function accumulateArtworkFocus(
  id: string,
  addedSeconds: number,
): Promise<void> {
  await withTransaction(async () => {
    const rows = await query<ArtworkRow>('SELECT * FROM artworks WHERE id = ?', [id])
    const row = rows[0]
    if (!row) return
    const total = row.accumulatedFocusSeconds + Math.max(0, Math.round(addedSeconds))
    const done = total >= row.requiredFocusSeconds
    const wasDone = row.completionStatus === 'completed'
    await run(
      `UPDATE artworks SET accumulatedFocusSeconds = ?, completionStatus = ?,
         completedAt = ? WHERE id = ?`,
      [
        total,
        done ? 'completed' : 'in_progress',
        done ? (wasDone ? row.completedAt : Date.now()) : null,
        id,
      ],
    )
  })
  emitDataChange('artworks')
}

/** 编辑/删除记录后回收画作进度：以全量会话重算累计值，保证统计一致 */
export async function recomputeArtworkAccumulation(
  artworkId: string,
  totalEffectiveSeconds: number,
): Promise<void> {
  await withTransaction(async () => {
    const rows = await query<ArtworkRow>('SELECT * FROM artworks WHERE id = ?', [artworkId])
    const row = rows[0]
    if (!row) return
    const total = Math.max(0, Math.round(totalEffectiveSeconds))
    const done = total >= row.requiredFocusSeconds
    const wasDone = row.completionStatus === 'completed'
    await run(
      `UPDATE artworks SET accumulatedFocusSeconds = ?, completionStatus = ?, completedAt = ? WHERE id = ?`,
      [total, done ? 'completed' : 'in_progress', done ? (wasDone ? row.completedAt : Date.now()) : null, artworkId],
    )
  })
  emitDataChange('artworks')
}

/** 统一改写全部画作的上色所需时长，并按已累计秒数重算完成态 */
export async function setAllRequiredFocusSeconds(seconds: number): Promise<void> {
  const sec = Math.max(60, Math.round(seconds))
  const now = Date.now()
  await run(
    `UPDATE artworks SET requiredFocusSeconds = ?,
      completionStatus = CASE WHEN accumulatedFocusSeconds >= ? THEN 'completed' ELSE 'in_progress' END,
      completedAt = CASE
        WHEN accumulatedFocusSeconds >= ? THEN COALESCE(completedAt, ?)
        ELSE NULL
      END`,
    [sec, sec, sec, now],
  )
  emitDataChange('artworks')
}

export async function deleteArtwork(id: string): Promise<void> {
  await withTransaction(async () => {
    await run('UPDATE sessions SET artworkId = NULL, updatedAt = ? WHERE artworkId = ?', [Date.now(), id])
    await run('DELETE FROM artworks WHERE id = ?', [id])
  })
  emitDataChange('artworks')
  emitDataChange('sessions')
}
