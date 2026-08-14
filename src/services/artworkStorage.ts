/**
 * 画作文件存储。
 *
 * 选中的图片一律复制进应用私有持久目录（Filesystem Directory.Data），
 * 数据库只保存应用内 URI，不依赖系统返回的临时 URI。
 * 预设画作引用打包资源（preset: 前缀），不复制文件。
 */
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Preferences } from '@capacitor/preferences'
import type { Orientation } from '../types/models'

const ARTWORK_DIR = 'artworks'
const AVATAR_PATH = 'avatars/profile.jpg'
const PICK_PURPOSE_KEY = 'pendingImagePickPurpose'

export type ImagePickPurpose = 'artwork' | 'avatar'

let pendingRestoredImage: Blob | null = null
let restoreHooked = false
const restoredListeners = new Set<(blob: Blob) => void>()

export function takePendingRestoredImage(): Blob | null {
  const blob = pendingRestoredImage
  pendingRestoredImage = null
  return blob
}

export function subscribeRestoredImage(fn: (blob: Blob) => void): () => void {
  restoredListeners.add(fn)
  return () => {
    restoredListeners.delete(fn)
  }
}

/** 应用启动时调用：系统回收后把相册选择结果交回，避免丢失 */
export function hookCameraRestore(
  onRestored: (blob: Blob, purpose: ImagePickPurpose) => void,
): void {
  if (restoreHooked || !Capacitor.isNativePlatform()) return
  restoreHooked = true
  void App.addListener('appRestoredResult', (event) => {
    void (async () => {
      if (!event.success) return
      if (event.pluginId !== 'Camera') return
      const data = event.data as {
        webPath?: string
        path?: string
        results?: { webPath?: string }[]
      } | undefined
      const webPath = data?.webPath ?? data?.results?.[0]?.webPath
      if (!webPath) return
      try {
        const blob = await (await fetch(webPath)).blob()
        const { value } = await Preferences.get({ key: PICK_PURPOSE_KEY })
        await Preferences.remove({ key: PICK_PURPOSE_KEY })
        const purpose: ImagePickPurpose = value === 'avatar' ? 'avatar' : 'artwork'
        if (restoredListeners.size > 0) {
          restoredListeners.forEach((fn) => fn(blob))
        } else {
          pendingRestoredImage = blob
        }
        onRestored(blob, purpose)
      } catch {
        /* 恢复失败则丢弃，用户可重新选择 */
      }
    })()
  })
}

export interface ImportedImage {
  filePath: string
  thumbnailPath: string
  aspectRatio: number
  orientation: Orientation
}

/** 从系统相册选择（原生走 Camera 插件；Web 退化为文件选择框） */
export async function pickImageFromGallery(
  purpose: ImagePickPurpose = 'artwork',
): Promise<Blob | null> {
  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key: PICK_PURPOSE_KEY, value: purpose })
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Photos,
        resultType: CameraResultType.Uri,
        quality: 95,
      })
      await Preferences.remove({ key: PICK_PURPOSE_KEY })
      if (!photo.webPath) return null
      const res = await fetch(photo.webPath)
      return await res.blob()
    } catch {
      await Preferences.remove({ key: PICK_PURPOSE_KEY })
      return null // 用户取消
    }
  }
  return pickImageViaInput()
}

/** 从「文件」导入：各端统一使用系统文件选择器 */
export function pickImageViaInput(): Promise<Blob | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    // 部分 WebView 取消选择不触发任何事件，这里以 cancel 事件兜底
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      resolve(url.slice(url.indexOf(',') + 1))
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function measureBlob(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    return { width: img.naturalWidth, height: img.naturalHeight }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 生成缩略图（最长边 480px JPEG） */
async function makeThumbnail(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = url
    })
    const scale = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? blob), 'image/jpeg', 0.82),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function ensureDir(): Promise<void> {
  try {
    await Filesystem.mkdir({ path: ARTWORK_DIR, directory: Directory.Data, recursive: true })
  } catch {
    /* 已存在 */
  }
}

async function writeBlob(path: string, blob: Blob): Promise<void> {
  await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Data,
  })
}

/** 保存导入的画作（原图 + 缩略图），返回应用内相对路径 */
export async function saveImportedImage(id: string, blob: Blob): Promise<ImportedImage> {
  await ensureDir()
  const { width, height } = await measureBlob(blob)
  const filePath = `${ARTWORK_DIR}/${id}.jpg`
  const thumbnailPath = `${ARTWORK_DIR}/${id}.thumb.jpg`
  await writeBlob(filePath, blob)
  await writeBlob(thumbnailPath, await makeThumbnail(blob))
  const aspectRatio = height > 0 ? width / height : 1
  return {
    filePath,
    thumbnailPath,
    aspectRatio,
    orientation:
      Math.abs(aspectRatio - 1) < 0.08
        ? 'square'
        : aspectRatio > 1
          ? 'landscape'
          : 'portrait',
  }
}

export async function saveAvatarImage(blob: Blob): Promise<string> {
  try {
    await Filesystem.mkdir({ path: 'avatars', directory: Directory.Data, recursive: true })
  } catch {
    /* 已存在 */
  }
  await writeBlob(AVATAR_PATH, blob)
  blobUrlCache.delete(AVATAR_PATH)
  return AVATAR_PATH
}

export async function deleteArtworkFiles(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      await Filesystem.deleteFile({ path: p, directory: Directory.Data })
    } catch {
      /* 文件不存在时忽略 */
    }
  }
}

/* ---------- URI → 可显示 src ---------- */

const blobUrlCache = new Map<string, string>()

/**
 * 将数据库存储的 URI 解析为 <img> 可用地址。
 * - preset:xxx → 打包资源 ./presets/xxx
 * - 原生 → Capacitor.convertFileSrc
 * - Web → 从 Filesystem(IndexedDB) 读出并生成 blob URL（带缓存）
 */
export async function resolveImageSrc(uri: string): Promise<string> {
  if (uri.startsWith('preset:')) {
    return `./presets/${uri.slice('preset:'.length)}`
  }
  if (Capacitor.isNativePlatform()) {
    const { uri: fileUri } = await Filesystem.getUri({
      path: uri,
      directory: Directory.Data,
    })
    return Capacitor.convertFileSrc(fileUri)
  }
  const cached = blobUrlCache.get(uri)
  if (cached) return cached
  const res = await Filesystem.readFile({ path: uri, directory: Directory.Data })
  const base64 = typeof res.data === 'string' ? res.data : await res.data.text()
  const mime = uri.endsWith('.thumb.jpg') || uri.endsWith('.jpg') ? 'image/jpeg' : 'image/png'
  const blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], { type: mime })
  const url = URL.createObjectURL(blob)
  blobUrlCache.set(uri, url)
  return url
}
