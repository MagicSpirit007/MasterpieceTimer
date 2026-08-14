import { useEffect, useRef, useState } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { initDatabase } from './db/database'
import { seedIfEmpty } from './services/seed'
import { applyAppearance, applyCanvasSetting, loadSettings } from './services/settings'
import { AppearancePage } from './pages/AppearancePage'
import { FeedbackPage } from './pages/FeedbackPage'
import { ArchivePage } from './pages/ArchivePage'
import { DataPage } from './pages/DataPage'
import { ColoringDurationPage } from './pages/ColoringDurationPage'
import { useDataVersion } from './db/events'
import { focusController } from './timer/focusController'
import { useFocusTimer } from './timer/useFocusTimer'
import { hookCameraRestore } from './services/artworkStorage'
import { TabBar } from './components/TabBar'
import { HomePage } from './pages/HomePage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { FocusSetupPage } from './pages/FocusSetupPage'
import { FocusPage } from './pages/FocusPage'
import { StatsPage } from './pages/StatsPage'
import { GalleryPage } from './pages/GalleryPage'
import { SettingsPage } from './pages/SettingsPage'
import { ArtworksPage } from './pages/ArtworksPage'

/** 不显示一级导航的沉浸式路由 */
const CHROMELESS = ['/focus', '/setup']

function Shell() {
  const location = useLocation()
  const hideTabs = CHROMELESS.some((p) => location.pathname.startsWith(p))
  const settingsVersion = useDataVersion('settings')

  // 外观设置变化时重新应用
  useEffect(() => {
    void loadSettings().then((s) => {
      applyAppearance(s.appearance)
      applyCanvasSetting(s.canvasId)
    })
  }, [settingsVersion])

  // 原生状态栏样式跟随主题
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      const theme = document.documentElement.dataset.theme
      const dark = theme ? theme === 'dark' : mq.matches
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <AutoCompleteBridge />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/project/:id" element={<ProjectDetailPage />} />
        <Route path="/setup" element={<FocusSetupPage />} />
        <Route path="/focus" element={<FocusPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/me" element={<SettingsPage />} />
        <Route path="/me/appearance" element={<AppearancePage />} />
        <Route path="/me/feedback" element={<FeedbackPage />} />
        <Route path="/me/archive" element={<ArchivePage />} />
        <Route path="/me/data" element={<DataPage />} />
        <Route path="/me/coloring" element={<ColoringDurationPage />} />
        <Route path="/artworks" element={<ArtworksPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
      {!hideTabs && <TabBar />}
    </>
  )
}

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <HashRouter>
      <AppInitializer onReady={() => setReady(true)} onError={setError} />
      <BootstrapGate ready={ready} error={error}>
        {ready && <Shell />}
      </BootstrapGate>
    </HashRouter>
  )
}

function BootstrapGate({
  ready,
  error,
  children,
}: {
  ready: boolean
  error: string | null
  children: React.ReactNode
}) {
  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p>初始化失败</p>
        <p style={{ opacity: 0.6, fontSize: 13, maxWidth: 320, margin: '8px auto' }}>{error}</p>
        <button
          className="btn-ghost"
          style={{ marginTop: 16 }}
          onClick={() => {
            try {
              localStorage.removeItem('masterpiece.sqlite.b64')
            } catch {
              /* ignore */
            }
            window.location.reload()
          }}
        >
          清空本地库并重试
        </button>
      </div>
    )
  }
  if (!ready) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-3)',
        }}
        role="status"
      >
        正在准备画布…
      </div>
    )
  }
  return <>{children}</>
}

/** React StrictMode 会双挂载，启动流程必须做成单例以免种子数据写两遍 */
let bootPromise: Promise<boolean> | null = null

function ensureBoot(navigateToRestored: (path: string) => void): Promise<boolean> {
  if (!bootPromise) {
    bootPromise = (async () => {
      await initDatabase()
      await seedIfEmpty()
      const settings = await loadSettings()
      applyAppearance(settings.appearance)
      applyCanvasSetting(settings.canvasId)
      const restored = await focusController.restore()
      hookCameraRestore((_blob, purpose) => {
        navigateToRestored(purpose === 'avatar' ? '/me' : '/artworks')
      })
      if (Capacitor.isNativePlatform()) {
        void SplashScreen.hide().catch(() => {})
      }
      return restored
    })()
  }
  return bootPromise
}

/** 初始化：数据库 → 种子数据 → 设置外观 → 恢复未完成的专注会话 */
function AppInitializer({
  onReady,
  onError,
}: {
  onReady: () => void
  onError: (msg: string) => void
}) {
  const navigate = useNavigate()
  useEffect(() => {
    let alive = true
    void ensureBoot((path) => navigate(path))
      .then((restored) => {
        if (!alive) return
        onReady()
        if (restored) navigate('/focus')
      })
      .catch((e: unknown) => {
        if (!alive) return
        onError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

/** 不在专注页时，倒计时归零仍跳回专注页由该页完成总结 */
function AutoCompleteBridge() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathRef = useRef(location.pathname)
  pathRef.current = location.pathname
  useFocusTimer(() => {
    if (pathRef.current !== '/focus') navigate('/focus')
  })
  return null
}
