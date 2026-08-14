import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Project } from '../types/models'
import { listProjects, setProjectArchived } from '../db/repositories/projects'
import { useDataVersion } from '../db/events'
import ui from '../components/ui.module.css'
import styles from './SettingsPage.module.css'

export function ArchivePage() {
  const navigate = useNavigate()
  const version = useDataVersion()
  const [archived, setArchived] = useState<Project[]>([])

  useEffect(() => {
    void listProjects(true).then((ps) => setArchived(ps.filter((p) => p.isArchived)))
  }, [version])

  return (
    <div className="page">
      <div className="row" style={{ padding: '12px 20px 0' }}>
        <button className="btn-ghost" style={{ minHeight: 36 }} onClick={() => navigate(-1)}>
          ‹ 返回
        </button>
      </div>
      <h1 className="page-title">归档</h1>
      <div className="page-scroll">
        {archived.length === 0 ? (
          <div className={ui.empty}>
            <p>还没有归档的项目</p>
          </div>
        ) : (
          <div className={styles.group}>
            {archived.map((p) => (
              <div key={p.id} className={styles.archiveRow}>
                <button
                  className={styles.archiveName}
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  {p.name}
                </button>
                <button
                  className="btn-ghost"
                  style={{ minHeight: 36 }}
                  onClick={() => void setProjectArchived(p.id, false)}
                >
                  取消归档
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
