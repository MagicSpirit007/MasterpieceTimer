/**
 * 我的：资料留在一级；设置全部进二级。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDataVersion } from '../db/events'
import { useImageSrc } from '../hooks/useImageSrc'
import { loadSettings, saveSettings } from '../services/settings'
import {
  pickImageFromGallery,
  saveAvatarImage,
  subscribeRestoredImage,
  takePendingRestoredImage,
} from '../services/artworkStorage'
import type { UserSettings } from '../types/models'
import styles from './SettingsPage.module.css'

export function SettingsPage() {
  const navigate = useNavigate()
  const version = useDataVersion()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  useEffect(() => {
    void loadSettings().then((s) => {
      setSettings(s)
      setNameDraft(s.userName)
    })
  }, [version])

  useEffect(() => {
    const blob = takePendingRestoredImage()
    if (blob) void applyAvatar(blob)
    return subscribeRestoredImage((next) => {
      void applyAvatar(next)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = async (next: Partial<UserSettings>) => {
    const saved = await saveSettings(next)
    setSettings(saved)
  }

  const applyAvatar = async (blob: Blob) => {
    if (!blob.type.startsWith('image/')) return
    const uri = await saveAvatarImage(blob)
    await patch({ avatarUri: uri })
  }

  const avatarSrc = useImageSrc(settings?.avatarUri)

  if (!settings) {
    return <div className="page" />
  }

  return (
    <div className="page">
      <h1 className="page-title">我的</h1>
      <div className="page-scroll">
        <p className="section-label">资料</p>
        <div className={styles.group}>
          <div className={styles.profile}>
            <button
              className={styles.avatarBtn}
              aria-label="更换头像"
              onClick={() =>
                void pickImageFromGallery('avatar').then((b) => {
                  if (b) void applyAvatar(b)
                })
              }
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className={styles.avatarImg} />
              ) : (
                <span>{(settings.userName || '专').slice(0, 1)}</span>
              )}
            </button>
            <input
              className={`field ${styles.nameField}`}
              value={nameDraft}
              aria-label="用户名"
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={() => {
                const name = nameDraft.trim() || '专注者'
                setNameDraft(name)
                if (name !== settings.userName) void patch({ userName: name })
              }}
            />
          </div>
        </div>

        <p className="section-label">设置</p>
        <div className={styles.group}>
          <button className={styles.navRow} onClick={() => navigate('/me/archive')}>
            <span>归档</span>
            <span className={styles.chev}>已归档的项目 ›</span>
          </button>
          <button className={styles.navRow} onClick={() => navigate('/me/coloring')}>
            <span>上色时长</span>
            <span className={styles.chev}>
              {settings.artworkColoringMinutes} 分钟 ›
            </span>
          </button>
          <button className={styles.navRow} onClick={() => navigate('/me/appearance')}>
            <span>外观</span>
            <span className={styles.chev}>浅深色与画布 ›</span>
          </button>
          <button className={styles.navRow} onClick={() => navigate('/me/feedback')}>
            <span>反馈</span>
            <span className={styles.chev}>声音、触感、通知 ›</span>
          </button>
          <button className={styles.navRow} onClick={() => navigate('/artworks')}>
            <span>画作管理</span>
            <span className={styles.chev}>导入与编辑 ›</span>
          </button>
          <button className={styles.navRow} onClick={() => navigate('/me/data')}>
            <span>数据</span>
            <span className={styles.chev}>备份与清空 ›</span>
          </button>
        </div>
      </div>
    </div>
  )
}
