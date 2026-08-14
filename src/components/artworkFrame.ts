/** 画幅在舞台里的平移：虚拟分割线右侧为已上色，左侧未上色。 */

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** 手卷右侧包首 / 空绫，上色从真正起首算起。 */
export const HANDSCROLL_START_INSET = 0.08

export function startInsetPx(artW: number, handscroll: boolean): number {
  if (!handscroll || artW <= 0) return 0
  return artW * HANDSCROLL_START_INSET
}

/**
 * 适配：高度铺满后若画比屏宽，虚拟线尽量钉在屏心，画跟着移。
 * 已上色还铺不满右半屏时画先不动，线从右缘走到屏心；
 * 未上色铺不满左半屏时画停在左齐，线继续往左走完。
 * 画能整幅放下时只居中，线在画上走。
 */
export function computeFitTranslate(
  progress: number,
  artW: number,
  stageW: number,
  startInset = 0,
): number {
  const p = clamp01(progress)
  if (artW <= 0 || stageW <= 0) return 0
  if (artW <= stageW) return (stageW - artW) / 2
  const inset = Math.max(0, Math.min(startInset, artW * 0.4))
  const span = Math.max(1, artW - inset)
  const lineOnArt = (1 - p) * span
  const desired = stageW / 2 - lineOnArt
  const minTx = stageW - span
  const maxTx = 0
  return Math.max(minTx, Math.min(maxTx, desired))
}

/** 全览手卷：从右起首平移到左题跋。架上画由 flex 居中，返回 0。 */
export function computeOverviewTranslate(
  progress: number,
  artW: number,
  stageW: number,
  handscroll: boolean,
): number {
  const p = clamp01(progress)
  if (!handscroll || artW <= stageW || artW <= 0 || stageW <= 0) return 0
  const inset = startInsetPx(artW, true)
  const startTx = stageW - artW + inset
  return startTx * (1 - p) || 0
}
