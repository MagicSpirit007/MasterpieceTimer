/**
 * 用户数据导出 / 导入 / 清空。
 * JSON 只含项目、画作元数据、专注记录与设置，不含画作二进制。
 */
import type { Artwork, FocusSession, Project, UserSettings } from '../types/models'
import {
  dumpCatalog,
  listImportedArtworkUris,
  replaceCatalog,
  wipeCatalog,
} from '../db/repositories/backup'
import { deleteArtworkFiles } from './artworkStorage'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resetSettings,
  saveSettings,
} from './settings'
import { seedIfEmpty } from './seed'
import { focusController } from '../timer/focusController'

export const BACKUP_VERSION = 1

export interface BackupPayload {
  version: number
  exportedAt: number
  projects: Project[]
  artworks: Artwork[]
  sessions: FocusSession[]
  settings: UserSettings
}

export async function exportBackup(): Promise<BackupPayload> {
  const [{ projects, artworks, sessions }, settings] = await Promise.all([
    dumpCatalog(),
    loadSettings(),
  ])
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    projects,
    artworks,
    sessions,
    settings,
  }
}

export function downloadBackupJson(payload: BackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const d = new Date(payload.exportedAt)
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  a.href = url
  a.download = `masterpiece-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseBackupJson(text: string): BackupPayload {
  let raw: unknown
  try {
    raw = JSON.parse(text) as unknown
  } catch {
    throw new Error('文件不是有效的 JSON')
  }
  if (!isBackupPayload(raw)) {
    throw new Error('备份文件格式不正确')
  }
  return raw
}

export async function importBackup(payload: BackupPayload): Promise<void> {
  await focusController.discard()
  const importedUris = await listImportedArtworkUris()
  if (importedUris.length > 0) {
    await deleteArtworkFiles(...importedUris)
  }
  await replaceCatalog({
    projects: payload.projects,
    artworks: payload.artworks,
    sessions: payload.sessions,
  })
  await saveSettings({ ...DEFAULT_SETTINGS, ...payload.settings })
}

export async function clearAllUserData(): Promise<void> {
  await focusController.discard()
  const importedUris = await listImportedArtworkUris()
  if (importedUris.length > 0) {
    await deleteArtworkFiles(...importedUris)
  }
  await wipeCatalog()
  await resetSettings()
  await seedIfEmpty()
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function isBackupPayload(v: unknown): v is BackupPayload {
  if (!isRecord(v)) return false
  if (v.version !== BACKUP_VERSION) return false
  if (!Array.isArray(v.projects) || !Array.isArray(v.artworks) || !Array.isArray(v.sessions)) {
    return false
  }
  if (!isRecord(v.settings)) return false
  return v.projects.every(isProject) && v.artworks.every(isArtwork) && v.sessions.every(isSession)
}

function isProject(v: unknown): v is Project {
  if (!isRecord(v)) return false
  return typeof v.id === 'string' && typeof v.name === 'string'
}

function isArtwork(v: unknown): v is Artwork {
  if (!isRecord(v)) return false
  return typeof v.id === 'string' && typeof v.title === 'string' && typeof v.originalImageUri === 'string'
}

function isSession(v: unknown): v is FocusSession {
  if (!isRecord(v)) return false
  return (
    typeof v.id === 'string' &&
    typeof v.projectId === 'string' &&
    typeof v.startedAt === 'number' &&
    typeof v.effectiveSeconds === 'number'
  )
}
