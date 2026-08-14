/**
 * 首次启动种子：默认项目 + 内置名画。
 * 名画按稳定 id 幂等写入，已有进度不重置。
 */
import { listProjects, createProject } from '../db/repositories/projects'
import { ensurePresetArtwork } from '../db/repositories/artworks'
import { loadSettings } from './settings'
import type { ArtworkDisplayMode, Orientation } from '../types/models'

interface MasterpieceDef {
  id: string
  file: string
  thumb: string
  title: string
  artist: string
  source: string
  licenseNote: string
  aspectRatio: number
  orientation: Orientation
  dominantColor: string
  canvasId: string
  displayMode: ArtworkDisplayMode
}

/** HandmadePiece Top 100 第 1–10 名 + 千里江山图 */
export const MASTERPIECES: MasterpieceDef[] = [
  {
    id: 'preset:starry-night',
    file: 'masterpieces/starry-night.jpg',
    thumb: 'masterpieces/starry-night.thumb.jpg',
    title: '星夜',
    artist: '文森特·梵高',
    source: 'HandmadePiece 榜 #1 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 1920 / 1520,
    orientation: 'landscape',
    dominantColor: '#2c4f86',
    canvasId: 'oil-linen',
    displayMode: 'easel',
  },
  {
    id: 'preset:the-kiss',
    file: 'masterpieces/the-kiss.jpg',
    thumb: 'masterpieces/the-kiss.thumb.jpg',
    title: '吻',
    artist: '古斯塔夫·克里姆特',
    source: 'HandmadePiece 榜 #2 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 1280 / 1284,
    orientation: 'square',
    dominantColor: '#c4a04a',
    canvasId: 'oil-linen',
    displayMode: 'easel',
  },
  {
    id: 'preset:pearl-earring',
    file: 'masterpieces/pearl-earring.jpg',
    thumb: 'masterpieces/pearl-earring.thumb.jpg',
    title: '戴珍珠耳环的少女',
    artist: '约翰内斯·维米尔',
    source: 'HandmadePiece 榜 #3 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 1280 / 1516,
    orientation: 'portrait',
    dominantColor: '#2a3d5c',
    canvasId: 'oil-linen',
    displayMode: 'easel',
  },
  {
    id: 'preset:adele-bloch-bauer',
    file: 'masterpieces/adele-bloch-bauer.jpg',
    thumb: 'masterpieces/adele-bloch-bauer.thumb.jpg',
    title: '阿黛尔·布洛赫-鲍尔一世',
    artist: '古斯塔夫·克里姆特',
    source: 'HandmadePiece 榜 #4 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 1280 / 1281,
    orientation: 'square',
    dominantColor: '#c9a227',
    canvasId: 'oil-linen',
    displayMode: 'easel',
  },
  {
    id: 'preset:salvator-mundi',
    file: 'masterpieces/salvator-mundi.jpg',
    thumb: 'masterpieces/salvator-mundi.thumb.jpg',
    title: '救世主',
    artist: '达·芬奇（归属）',
    source: 'HandmadePiece 榜 #5 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 960 / 1413,
    orientation: 'portrait',
    dominantColor: '#3d4a38',
    canvasId: 'wood-panel',
    displayMode: 'easel',
  },
  {
    id: 'preset:lady-of-shalott',
    file: 'masterpieces/lady-of-shalott.jpg',
    thumb: 'masterpieces/lady-of-shalott.thumb.jpg',
    title: '夏洛特夫人',
    artist: '约翰·威廉·沃特豪斯',
    source: 'HandmadePiece 榜 #6 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 1800 / 1381,
    orientation: 'landscape',
    dominantColor: '#4a6a7a',
    canvasId: 'oil-linen',
    displayMode: 'easel',
  },
  {
    id: 'preset:boating-party',
    file: 'masterpieces/boating-party.jpg',
    thumb: 'masterpieces/boating-party.thumb.jpg',
    title: '游船上的午餐',
    artist: '皮埃尔-奥古斯特·雷诺阿',
    source: 'HandmadePiece 榜 #7 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 1280 / 948,
    orientation: 'landscape',
    dominantColor: '#8a7a5a',
    canvasId: 'oil-linen',
    displayMode: 'easel',
  },
  {
    id: 'preset:impression-sunrise',
    file: 'masterpieces/impression-sunrise.jpg',
    thumb: 'masterpieces/impression-sunrise.thumb.jpg',
    title: '日出·印象',
    artist: '克劳德·莫奈',
    source: 'HandmadePiece 榜 #8 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 1600 / 1245,
    orientation: 'landscape',
    dominantColor: '#6a7a88',
    canvasId: 'oil-linen',
    displayMode: 'easel',
  },
  {
    id: 'preset:starry-rhone',
    file: 'masterpieces/starry-rhone.jpg',
    thumb: 'masterpieces/starry-rhone.thumb.jpg',
    title: '罗纳河上的星夜',
    artist: '文森特·梵高',
    source: 'HandmadePiece 榜 #9 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 1280 / 992,
    orientation: 'landscape',
    dominantColor: '#1e3a5f',
    canvasId: 'oil-linen',
    displayMode: 'easel',
  },
  {
    id: 'preset:irises',
    file: 'masterpieces/irises.jpg',
    thumb: 'masterpieces/irises.thumb.jpg',
    title: '鸢尾花',
    artist: '文森特·梵高',
    source: 'HandmadePiece 榜 #10 · Wikimedia Commons',
    licenseNote: '公有领域',
    aspectRatio: 1280 / 978,
    orientation: 'landscape',
    dominantColor: '#3d5a4a',
    canvasId: 'oil-linen',
    displayMode: 'easel',
  },
  {
    id: 'preset:qianli-jiangshan',
    file: 'masterpieces/qianli-jiangshan.jpg',
    thumb: 'masterpieces/qianli-jiangshan.thumb.jpg',
    title: '千里江山图',
    artist: '王希孟',
    source: 'Wikimedia Commons · 故宫博物院藏本摄影',
    licenseNote: '公有领域（北宋绢本设色）',
    aspectRatio: 27482 / 1100,
    orientation: 'landscape',
    dominantColor: '#2a6a5a',
    canvasId: 'silk',
    displayMode: 'handscroll',
  },
]

const DEFAULT_PROJECTS = ['阅读', '英语', '编程']

export async function ensureMasterpieces(): Promise<void> {
  const coloringSeconds = Math.max(60, (await loadSettings()).artworkColoringMinutes * 60)
  for (const p of MASTERPIECES) {
    try {
    await ensurePresetArtwork({
      id: p.id,
      title: p.title,
      artist: p.artist,
      source: p.source,
      licenseNote: p.licenseNote,
      originalImageUri: `preset:${p.file}`,
      thumbnailUri: `preset:${p.thumb}`,
      aspectRatio: p.aspectRatio,
      orientation: p.orientation,
      dominantColor: p.dominantColor,
      requiredFocusSeconds: coloringSeconds,
      isPreset: true,
      note: '',
      canvasId: p.canvasId,
      displayMode: p.displayMode,
    })
    } catch (err) {
      console.warn('preset skip', p.id, err)
    }
  }
}

export async function seedIfEmpty(): Promise<void> {
  if ((await listProjects(true)).length === 0) {
    for (const name of DEFAULT_PROJECTS) {
      await createProject({ name })
    }
  }
  await ensureMasterpieces()
}
