/**
 * ArtworkReveal —— 画作随专注进度恢复色彩。
 *
 * 适配：高度铺满舞台，上色竖线钉在视口水平中线，画布平移。
 * 全览：contain 整幅，线在画上走。
 * 手卷影像为右起首、左题跋。
 */
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { ArtworkDisplayMode } from '../types/models'
import styles from './ArtworkReveal.module.css'

export type ArtworkViewMode = 'fit' | 'overview'

export interface ArtworkRevealProps {
  src: string
  aspectRatio: number
  progress: number
  alt: string
  hideBoundaryWhenDone?: boolean
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
  hideBoundaryWhenDone = true,
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
  const done = p >= 1
  const revealStyle = { '--reveal': p } as CSSProperties

  let tx = 0
  if (rect.w > 0) {
    if (fit) {
      const startInset = scroll ? rect.w * 0.08 : 0
      const revealX = scroll
        ? (1 - p) * (rect.w - startInset)
        : p * rect.w
      tx = rect.stageW / 2 - revealX
    } else if (scroll && rect.w > rect.stageW) {
      const minTx = rect.stageW - rect.w
      const startInset = rect.w * 0.08
      const travel = Math.max(1, rect.w - rect.stageW - startInset)
      tx = Math.max(minTx, Math.min(0, -(startInset + p * travel)))
    }
  }

  const pinLine = fit

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
            ? '当前适配屏幕，点按切换全览'
            : '当前全览，点按切换适配屏幕'
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
            transform: `translate3d(${tx}px, 0, 0)`,
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
            data-scroll={scroll}
            style={revealStyle}
          />
          <div
            className={styles.boundary}
            style={revealStyle}
            data-hidden={pinLine || (hideBoundaryWhenDone && done)}
            data-scroll={scroll}
            aria-hidden
          />
        </div>
      )}
      {pinLine && !(hideBoundaryWhenDone && done) && (
        <div className={styles.centerLine} aria-hidden />
      )}
    </div>
  )
}
