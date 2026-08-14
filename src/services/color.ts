/**
 * 画作主题色提取与动态色板。
 *
 * 原则：不直接使用高饱和取样色。提取代表色后降低饱和度、
 * 按明暗模式调整明度并与基础背景混合，得到安静、低对比的色板；
 * 文字对比度由固定文字色 + 受控明度范围保证。
 */

export interface Palette {
  /** 强调色（按钮、进度、图表） */
  tint: string
  tintStrong: string
  tintSoft: string
  tintContrast: string
  /** 专注页画作背后的柔和承接背景（主题色淡化） */
  canvasBg: string
  canvasWash: string
}

export const NEUTRAL_PALETTE_LIGHT: Palette = {
  tint: '#7d6c4f',
  tintStrong: '#6b5a3e',
  tintSoft: 'rgba(125, 108, 79, 0.12)',
  tintContrast: '#ffffff',
  canvasBg: '#e9e6df',
  canvasWash: '#efe8d8',
}

export const NEUTRAL_PALETTE_DARK: Palette = {
  tint: '#c9b48c',
  tintStrong: '#d8c49c',
  tintSoft: 'rgba(201, 180, 140, 0.16)',
  tintContrast: '#17130c',
  canvasBg: '#191820',
  canvasWash: '#1c1914',
}

/* ---------- HSL 工具 ---------- */

interface Hsl {
  h: number
  s: number
  l: number
}

function hexToHsl(hex: string): Hsl | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return null
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s, l }
}

function hslToHex({ h, s, l }: Hsl): string {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/* ---------- 提取 ---------- */

/**
 * 从图片提取代表色：缩小采样后按色相聚类，取「饱和度 × 像素数」
 * 权重最高的色相桶，桶内取平均。颜色过杂或失败时返回空串。
 */
export async function extractDominantColor(src: string): Promise<string> {
  try {
    const img = await loadImage(src)
    const size = 48
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return ''
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)

    const buckets = new Map<number, { r: number; g: number; b: number; w: number; n: number }>()
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] ?? 0
      if (a < 200) continue
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      const hex = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
      const hsl = hexToHsl(hex)
      if (!hsl) continue
      // 跳过近黑近白与近灰像素，找真正有色彩倾向的部分
      if (hsl.l < 0.12 || hsl.l > 0.92 || hsl.s < 0.08) continue
      const key = Math.floor(hsl.h / 24) // 15 个色相桶
      const weight = hsl.s * (1 - Math.abs(hsl.l - 0.5))
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, w: 0, n: 0 }
      bucket.r += r * weight
      bucket.g += g * weight
      bucket.b += b * weight
      bucket.w += weight
      bucket.n += 1
      buckets.set(key, bucket)
    }
    if (buckets.size === 0) return ''
    const best = [...buckets.values()].reduce((a, b) => (b.w > a.w ? b : a))
    // 颜色过杂（最高桶占比过低）时交给中性色板
    const totalW = [...buckets.values()].reduce((s, b) => s + b.w, 0)
    if (best.w / totalW < 0.18) return ''
    const to255 = (v: number) => Math.round(v / best.w)
    return `#${((to255(best.r) << 16) | (to255(best.g) << 8) | to255(best.b)).toString(16).padStart(6, '0')}`
  } catch {
    return ''
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/* ---------- 色板派生 ---------- */

/** 由代表色派生完整色板；提取失败（空串）时使用中性色板 */
export function derivePalette(dominantHex: string, theme: 'light' | 'dark'): Palette {
  const fallback = theme === 'light' ? NEUTRAL_PALETTE_LIGHT : NEUTRAL_PALETTE_DARK
  const hsl = hexToHsl(dominantHex)
  if (!hsl) return fallback

  const s = Math.min(hsl.s, 0.38) // 降饱和
  if (theme === 'light') {
    const tint = hslToHex({ h: hsl.h, s, l: 0.42 })
    const tintStrong = hslToHex({ h: hsl.h, s: Math.min(hsl.s, 0.45), l: 0.34 })
    const canvasBg = hslToHex({ h: hsl.h, s: Math.min(Math.max(hsl.s, 0.12), 0.28), l: 0.86 })
    const canvasWash = hslToHex({ h: hsl.h, s: Math.min(Math.max(hsl.s, 0.1), 0.24), l: 0.88 })
    return {
      tint,
      tintStrong,
      tintSoft: hexWithAlpha(tint, 0.14),
      tintContrast: '#ffffff',
      canvasBg,
      canvasWash,
    }
  }
  const tint = hslToHex({ h: hsl.h, s, l: 0.72 })
  const tintStrong = hslToHex({ h: hsl.h, s: Math.min(hsl.s, 0.45), l: 0.78 })
  const canvasBg = hslToHex({ h: hsl.h, s: Math.min(Math.max(hsl.s, 0.1), 0.22), l: 0.16 })
  const canvasWash = hslToHex({ h: hsl.h, s: Math.min(Math.max(hsl.s, 0.08), 0.2), l: 0.18 })
  return {
    tint,
    tintStrong,
    tintSoft: hexWithAlpha(tint, 0.18),
    tintContrast: '#17130c',
    canvasBg,
    canvasWash,
  }
}

function hexWithAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
  return `${hex}${a}`
}

/* ---------- 应用到文档 ---------- */

/** 将色板写入 CSS 变量；配合 CSS transition 实现平滑过渡 */
export function applyPalette(palette: Palette): void {
  const el = document.documentElement
  el.style.setProperty('--tint', palette.tint)
  el.style.setProperty('--tint-strong', palette.tintStrong)
  el.style.setProperty('--tint-soft', palette.tintSoft)
  el.style.setProperty('--tint-contrast', palette.tintContrast)
  el.style.setProperty('--canvas-bg', palette.canvasBg)
  el.style.setProperty('--canvas-wash', palette.canvasWash)
}

export function resetPalette(): void {
  const el = document.documentElement
  ;['--tint', '--tint-strong', '--tint-soft', '--tint-contrast', '--canvas-bg', '--canvas-wash'].forEach(
    (k) => el.style.removeProperty(k),
  )
}
