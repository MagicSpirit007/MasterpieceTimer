/** 将数据库中的画作 URI 解析为可显示 src 的 hook */
import { useEffect, useState } from 'react'
import { resolveImageSrc } from '../services/artworkStorage'

export function useImageSrc(uri: string | null | undefined): string {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let alive = true
    if (!uri) {
      setSrc('')
      return
    }
    void resolveImageSrc(uri).then((s) => {
      if (alive) setSrc(s)
    })
    return () => {
      alive = false
    }
  }, [uri])
  return src
}
