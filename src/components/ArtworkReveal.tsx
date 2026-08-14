/**
 * ArtworkReveal —— 画作随专注进度恢复色彩。
 *
 * 虚拟分割线右侧为已上色、左侧未上色，界面不画这根线。
 * 适配：高度铺满。画比屏宽时，上色铺不满右半屏则画不动、等线走到屏心；
 * 之后画跟着线平移，使线留在屏心；末端画停在左齐。
 * 全览：contain 整幅；手卷从右起首平移到左题跋。
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { ArtworkDisplayMode } from '../types/models'
import {
  computeFitTranslate,
  computeOverviewTranslate,
  startInsetPx,
} from './artworkFrame'
import styles from './ArtworkReveal.module.css'

export type ArtworkViewMode = 'fit' | 'overview'

export interface ArtworkRevealProps {
  src: string
  aspectRatio: number
  progress: number
  alt: string
  maxFill?: number
  rounded?: boolean
  displayMode?: ArtworkDisplayMode
  viewMode?: ArtworkViewMode
  onToggleView?: () => void
}

export function ArtworkReveal({
  src,
  aspectRatio,
  progress,
  alt,
  maxFill = 0.95,
  rounded = true,
  displayMode = 'easel',
  viewMode = 'overview',
  onToggleView,
}: ArtworkRevealProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState({ w: 0, h: 0, stageW: 0, stageH: 0 })
  const scroll = displayMode === 'handscroll'
  const fit = viewMode === 'fit'

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const compute = () => {
      const box = el.getBoundingClientRect()
      const stageW = Math.max(el.clientWidth, box.width)
      const stageH = Math.max(el.clientHeight, box.height)
      if (stageW <= 1 || stageH <= 1 || aspectRatio <= 0) return
      if (fit) {
        const h = stageH
        const w = h * aspectRatio
        setRect({ w: Math.round(w), h: Math.round(h), stageW, stageH })
        return
      }
      const availW = stageW * maxFill
      const availH = stageH * maxFill
      let w = availW
      let h = w / aspectRatio
      if (h > availH) {
        h = availH
        w = h * aspectRatio
      }
      setRect({ w: Math.round(w), h: Math.round(h), stageW, stageH })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspectRatio, maxFill, fit])

  const p = Math.min(1, Math.max(0, progress))
  const inset = rect.w > 0 ? startInsetPx(rect.w, scroll) / rect.w : 0
  const revealStyle = { '--reveal': p, '--inset': inset } as CSSProperties

  let tx = 0
  let ty = 0
  if (rect.w > 0) {
    if (fit) {
      tx = computeFitTranslate(p, rect.w, rect.stageW, startInsetPx(rect.w, scroll))
      ty = (rect.stageH - rect.h) / 2
    } else {
      tx = computeOverviewTranslate(p, rect.w, rect.stageW, scroll)
    }
  }

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-mode={displayMode}
      data-view={viewMode}
      role={onToggleView ? 'button' : undefined}
      tabIndex={onToggleView ? 0 : undefined}
      aria-label={
        onToggleView
          ? fit
            ? '当前适配屏幕，轻点切换全览'
            : '当前全览，轻点切换适配屏幕'
          : undefined
      }
      onClick={onToggleView}
      onKeyDown={
        onToggleView
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggleView()
              }
            }
          : undefined
      }
    >
      {rect.w > 0 && (
        <div
          className={styles.artRect}
          style={{
            width: rect.w,
            height: rect.h,
            borderRadius: rounded && !fit ? undefined : 0,
            transform: `translate3d(${tx}px, ${ty}px, 0)`,
            ...revealStyle,
          }}
        >
          <img className={`${styles.layer} ${styles.gray}`} src={src} alt={alt} draggable={false} />
          <img
            className={`${styles.layer} ${styles.color}`}
            src={src}
            alt=""
            aria-hidden
            draggable={false}
            style={revealStyle}
          />
        </div>
      )}
    </div>
  )
}
