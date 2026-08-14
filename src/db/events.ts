/** 极简数据变更事件：仓库写操作后 emit，页面用 useDataVersion 触发重取 */
import { useEffect, useState } from 'react'

export type DataTopic = 'projects' | 'artworks' | 'sessions' | 'settings'

const listeners = new Set<(topic: DataTopic) => void>()

export function emitDataChange(topic: DataTopic): void {
  listeners.forEach((fn) => fn(topic))
}

export function useDataVersion(topic?: DataTopic): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const fn = (t: DataTopic) => {
      if (!topic || t === topic) setVersion((v) => v + 1)
    }
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [topic])
  return version
}
