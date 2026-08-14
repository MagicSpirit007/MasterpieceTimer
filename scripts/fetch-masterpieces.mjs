/**
 * 从 Wikimedia Commons 拉取公有领域名画，压成包内 JPEG。
 * 运行：node scripts/fetch-masterpieces.mjs
 */
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'presets', 'masterpieces')

const UA = 'MasterpieceTimer/1.0 (local build; public-domain artwork fetch)'

const TARGETS = [
  {
    id: 'starry-night',
    urls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/2560px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/1920px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    ],
    thumbUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg/640px-Van_Gogh_-_Starry_Night_-_Google_Art_Project.jpg',
    ],
  },
  {
    id: 'qianli-jiangshan',
    urls: [
      // 完整长卷中等衍生；失败则退到高清局部（仍是公有领域原作摄影）
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/%E7%8E%8B%E5%B8%8C%E5%AD%9F%E5%8D%83%E9%87%8C%E6%B1%9F%E5%B1%B1%E5%9B%BE%E5%8D%B7.png/8000px-%E7%8E%8B%E5%B8%8C%E5%AD%9F%E5%8D%83%E9%87%8C%E6%B1%9F%E5%B1%B1%E5%9B%BE%E5%8D%B7.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/%E7%8E%8B%E5%B8%8C%E5%AD%9F%E5%8D%83%E9%87%8C%E6%B1%9F%E5%B1%B1%E5%9B%BE%E5%8D%B7.png/5120px-%E7%8E%8B%E5%B8%8C%E5%AD%9F%E5%8D%83%E9%87%8C%E6%B1%9F%E5%B1%B1%E5%9B%BE%E5%8D%B7.png',
      'https://upload.wikimedia.org/wikipedia/commons/b/b8/Wang_Ximeng_-_A_Thousand_Li_of_River1.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Wang_Ximeng._A_Thousand_Li_of_Rivers_and_Mountains._%28Complete%2C_51%2C3x1191%2C5_cm%29._1113._Palace_museum%2C_Beijing.jpg/3840px-Wang_Ximeng._A_Thousand_Li_of_Rivers_and_Mountains._%28Complete%2C_51%2C3x1191%2C5_cm%29._1113._Palace_museum%2C_Beijing.jpg',
    ],
    thumbUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Wang_Ximeng_-_A_Thousand_Li_of_River1.jpg/1280px-Wang_Ximeng_-_A_Thousand_Li_of_River1.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/Wang_Ximeng._A_Thousand_Li_of_Rivers_and_Mountains._%28Complete%2C_51%2C3x1191%2C5_cm%29._1113._Palace_museum%2C_Beijing.jpg/1280px-Wang_Ximeng._A_Thousand_Li_of_Rivers_and_Mountains._%28Complete%2C_51%2C3x1191%2C5_cm%29._1113._Palace_museum%2C_Beijing.jpg',
    ],
  },
]

async function fetchBuf(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength < 8_000) throw new Error(`too small ${buf.byteLength} ${url}`)
  return buf
}

async function firstOk(urls) {
  let last
  for (const url of urls) {
    try {
      const buf = await fetchBuf(url)
      return { buf, url }
    } catch (err) {
      last = err
      console.warn('skip', url, err instanceof Error ? err.message : err)
    }
  }
  throw last ?? new Error('no urls')
}

async function main() {
  await mkdir(outDir, { recursive: true })
  for (const t of TARGETS) {
    const dest = join(outDir, `${t.id}.jpg`)
    const thumbDest = join(outDir, `${t.id}.thumb.jpg`)
    try {
      const existing = await stat(dest)
      if (existing.size > 20_000) {
        console.log('keep', dest, existing.size)
        continue
      }
    } catch {
      /* download */
    }
    const full = await firstOk(t.urls)
    await writeFile(dest, full.buf)
    console.log('wrote', dest, full.buf.byteLength, 'from', full.url)
    try {
      const thumb = await firstOk(t.thumbUrls)
      await writeFile(thumbDest, thumb.buf)
      console.log('wrote', thumbDest, thumb.buf.byteLength)
    } catch {
      await writeFile(thumbDest, full.buf)
      console.log('thumb fallback', thumbDest)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
