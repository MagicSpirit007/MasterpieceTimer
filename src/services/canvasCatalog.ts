/** 画布底材目录：非专注页用设置默认；专注页用画作历史底材。 */

export const CANVAS_IDS = [
  'aged-xuan',
  'raw-xuan',
  'sized-xuan',
  'silk',
  'oil-linen',
  'oil-cotton',
  'wood-panel',
  'wc-coldpress',
  'kraft',
  'modern-white',
] as const

export type CanvasId = (typeof CANVAS_IDS)[number]

export interface CanvasDef {
  id: CanvasId
  name: string
  note: string
}

export const CANVAS_CATALOG: CanvasDef[] = [
  { id: 'aged-xuan', name: '泛黄宣纸', note: '陈年纤维，暖黄微斑' },
  { id: 'raw-xuan', name: '生宣', note: '松透吸墨，冷白' },
  { id: 'sized-xuan', name: '熟宣纸', note: '胶矾后更紧，牙白' },
  { id: 'silk', name: '绢本', note: '细织微光，青绿山水常用' },
  { id: 'oil-linen', name: '油画亚麻布', note: '斜纹织地，近代油画' },
  { id: 'oil-cotton', name: '油画棉布', note: '更平的布纹' },
  { id: 'wood-panel', name: '木板底', note: '竖向木纹，早期架上画' },
  { id: 'wc-coldpress', name: '水彩冷压纸', note: '点坑肌理' },
  { id: 'kraft', name: '素描牛皮纸', note: '暖褐，适合速写' },
  { id: 'modern-white', name: '现代白画布', note: '中性底，当代作品' },
]

export const DEFAULT_CANVAS_ID: CanvasId = 'aged-xuan'

export function isCanvasId(v: unknown): v is CanvasId {
  return typeof v === 'string' && (CANVAS_IDS as readonly string[]).includes(v)
}

export function resolveCanvasId(v: unknown, fallback: CanvasId = DEFAULT_CANVAS_ID): CanvasId {
  return isCanvasId(v) ? v : fallback
}

/** 将画布写到 <html data-canvas>，供 CSS 纹理层读取 */
export function applyCanvas(id: CanvasId): void {
  document.documentElement.dataset.canvas = id
}
