/**
 * 数据备份 / 整库替换。SQL 集中在仓库层。
 * 画作二进制不在备份范围内，只迁移元数据与记录。
 */
import type { Artwork, FocusSession, Project } from '../../types/models'
import { query, run, withTransaction } from '../database'
import { emitDataChange } from '../events'
import { listArtworks } from './artworks'
import { listProjects } from './projects'
import { listAllSessions } from './sessions'

export interface CatalogDump {
  projects: Project[]
  artworks: Artwork[]
  sessions: FocusSession[]
}

export async function dumpCatalog(): Promise<CatalogDump> {
  const [projects, artworks, sessions] = await Promise.all([
    listProjects(true),
    listArtworks(),
    listAllSessions(),
  ])
  return { projects, artworks, sessions }
}

export async function replaceCatalog(dump: CatalogDump): Promise<void> {
  await withTransaction(async () => {
    await run('DELETE FROM sessions')
    await run('DELETE FROM artworks')
    await run('DELETE FROM projects')

    for (const p of dump.projects) {
      await run(
        `INSERT INTO projects (id, name, color, icon, sortOrder, isArchived, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [p.id, p.name, p.color, p.icon, p.sortOrder, p.isArchived ? 1 : 0, p.createdAt],
      )
    }
    for (const a of dump.artworks) {
      await run(
        `INSERT INTO artworks (
          id, title, artist, source, licenseNote, originalImageUri, thumbnailUri,
          aspectRatio, orientation, dominantColor, requiredFocusSeconds,
          accumulatedFocusSeconds, completionStatus, completedAt, isPreset, note, createdAt,
          canvasId, displayMode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          a.id,
          a.title,
          a.artist,
          a.source,
          a.licenseNote,
          a.originalImageUri,
          a.thumbnailUri,
          a.aspectRatio,
          a.orientation,
          a.dominantColor,
          a.requiredFocusSeconds,
          a.accumulatedFocusSeconds,
          a.completionStatus,
          a.completedAt,
          a.isPreset ? 1 : 0,
          a.note,
          a.createdAt,
          a.canvasId || 'oil-linen',
          a.displayMode === 'handscroll' ? 'handscroll' : 'easel',
        ],
      )
    }
    for (const s of dump.sessions) {
      await run(
        `INSERT INTO sessions (
          id, projectId, artworkId, timerMode, plannedSeconds, startedAt, endedAt,
          effectiveSeconds, pausedSeconds, completionRate, status, note,
          isManual, isEdited, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id,
          s.projectId,
          s.artworkId,
          s.timerMode,
          s.plannedSeconds,
          s.startedAt,
          s.endedAt,
          s.effectiveSeconds,
          s.pausedSeconds,
          s.completionRate,
          s.status,
          s.note,
          s.isManual ? 1 : 0,
          s.isEdited ? 1 : 0,
          s.createdAt,
          s.updatedAt,
        ],
      )
    }
  })
  emitDataChange('projects')
  emitDataChange('artworks')
  emitDataChange('sessions')
}

export async function wipeCatalog(): Promise<void> {
  await withTransaction(async () => {
    await run('DELETE FROM sessions')
    await run('DELETE FROM artworks')
    await run('DELETE FROM projects')
  })
  emitDataChange('projects')
  emitDataChange('artworks')
  emitDataChange('sessions')
}

export async function listImportedArtworkUris(): Promise<string[]> {
  const rows = await query<{ originalImageUri: string; thumbnailUri: string }>(
    'SELECT originalImageUri, thumbnailUri FROM artworks WHERE isPreset = 0',
  )
  const out: string[] = []
  for (const r of rows) {
    if (r.originalImageUri) out.push(r.originalImageUri)
    if (r.thumbnailUri) out.push(r.thumbnailUri)
  }
  return out
}
