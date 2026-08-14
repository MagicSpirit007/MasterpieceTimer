import type { Project } from '../../types/models'
import { query, run, withTransaction } from '../database'
import { emitDataChange } from '../events'
import { newId } from '../../utils/format'

interface ProjectRow {
  id: string
  name: string
  color: string
  icon: string
  sortOrder: number
  isArchived: number
  createdAt: number
}

function toModel(r: ProjectRow): Project {
  return { ...r, isArchived: r.isArchived === 1 }
}

export async function listProjects(includeArchived = false): Promise<Project[]> {
  const rows = await query<ProjectRow>(
    `SELECT * FROM projects ${includeArchived ? '' : 'WHERE isArchived = 0'}
     ORDER BY isArchived ASC, sortOrder ASC, createdAt ASC`,
  )
  return rows.map(toModel)
}

export async function getProject(id: string): Promise<Project | null> {
  const rows = await query<ProjectRow>('SELECT * FROM projects WHERE id = ?', [id])
  return rows[0] ? toModel(rows[0]) : null
}

export async function createProject(
  input: Pick<Project, 'name'> & Partial<Pick<Project, 'color' | 'icon'>>,
): Promise<Project> {
  const max = await query<{ m: number | null }>(
    'SELECT MAX(sortOrder) AS m FROM projects',
  )
  const project: Project = {
    id: newId(),
    name: input.name.trim(),
    color: input.color ?? '',
    icon: input.icon ?? '',
    sortOrder: (max[0]?.m ?? -1) + 1,
    isArchived: false,
    createdAt: Date.now(),
  }
  await run(
    `INSERT INTO projects (id, name, color, icon, sortOrder, isArchived, createdAt)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
    [project.id, project.name, project.color, project.icon, project.sortOrder, project.createdAt],
  )
  emitDataChange('projects')
  return project
}

export async function renameProject(id: string, name: string): Promise<void> {
  await run('UPDATE projects SET name = ? WHERE id = ?', [name.trim(), id])
  emitDataChange('projects')
}

export async function setProjectArchived(id: string, archived: boolean): Promise<void> {
  await run('UPDATE projects SET isArchived = ? WHERE id = ?', [archived ? 1 : 0, id])
  emitDataChange('projects')
}

export async function moveProject(id: string, direction: -1 | 1): Promise<void> {
  await withTransaction(async () => {
    const all = await query<ProjectRow>(
      'SELECT * FROM projects WHERE isArchived = 0 ORDER BY sortOrder ASC',
    )
    const idx = all.findIndex((p) => p.id === id)
    const swap = all[idx + direction]
    const cur = all[idx]
    if (!cur || !swap) return
    await run('UPDATE projects SET sortOrder = ? WHERE id = ?', [swap.sortOrder, cur.id])
    await run('UPDATE projects SET sortOrder = ? WHERE id = ?', [cur.sortOrder, swap.id])
  })
  emitDataChange('projects')
}

/** 删除项目：历史专注记录保留（projectId 置空标记为已删除项目），保证统计不断档 */
export async function deleteProject(id: string): Promise<void> {
  await withTransaction(async () => {
    await run(
      `UPDATE sessions SET projectId = '(deleted)', updatedAt = ? WHERE projectId = ?`,
      [Date.now(), id],
    )
    await run('DELETE FROM projects WHERE id = ?', [id])
  })
  emitDataChange('projects')
  emitDataChange('sessions')
}
