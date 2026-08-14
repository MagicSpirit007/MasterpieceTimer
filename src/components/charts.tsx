/**
 * 轻量 SVG 图表（无第三方图表库）。
 * 设计原则：一张图只表达一个主要结论；趋势用面积折线，
 * 项目比较用排序条形，占比只在类别少时用环形。
 */

/* ---------- 趋势：面积折线 ---------- */

export interface TrendPoint {
  label: string
  value: number // 小时
}

export function TrendChart({
  points,
  unit = 'h',
  height = 160,
}: {
  points: TrendPoint[]
  unit?: string
  height?: number
}) {
  const w = 320
  const h = height
  const padX = 8
  const padTop = 14
  const padBottom = 22
  const max = Math.max(...points.map((p) => p.value), 0.1)
  const innerW = w - padX * 2
  const innerH = h - padTop - padBottom
  const n = Math.max(points.length - 1, 1)
  const coords = points.map((p, i) => ({
    x: padX + (i / n) * innerW,
    y: padTop + innerH - (p.value / max) * innerH,
  }))
  const line = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')
  const area = `${line} L${coords[coords.length - 1]?.x ?? padX},${h - padBottom} L${padX},${h - padBottom} Z`
  const labelEvery = Math.ceil(points.length / 6)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="专注趋势图">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--tint)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--tint)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1={padX} x2={w - padX} y1={h - padBottom} y2={h - padBottom} stroke="var(--separator)" strokeWidth="1" />
      {points.length > 0 && <path d={area} fill="url(#trendFill)" />}
      {points.length > 0 && (
        <path d={line} fill="none" stroke="var(--tint-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {coords.map((c, i) =>
        i % labelEvery === 0 || i === coords.length - 1 ? (
          <text key={i} x={c.x} y={h - 6} textAnchor="middle" fontSize="9" fill="var(--text-3)">
            {points[i]?.label}
          </text>
        ) : null,
      )}
      <text x={padX} y={10} fontSize="9" fill="var(--text-3)">
        {max.toFixed(1)} {unit}
      </text>
    </svg>
  )
}

/* ---------- 项目比较：排序横向条形 ---------- */

export interface BarItem {
  label: string
  value: number // 秒
  color?: string
}

export function BarList({
  items,
  format,
}: {
  items: BarItem[]
  format: (seconds: number) => string
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value)
  const max = Math.max(...sorted.map((i) => i.value), 1)
  return (
    <div role="img" aria-label="各项目专注时长">
      {sorted.map((item) => (
        <div key={item.label} style={{ marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="small">{item.label}</span>
            <span className="small t2">{format(item.value)}</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--fill)' }}>
            <div
              style={{
                height: '100%',
                width: `${(item.value / max) * 100}%`,
                borderRadius: 3,
                background: item.color || 'var(--tint-strong)',
                transition: 'width var(--dur-med) var(--ease-out)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------- 占比：环形（仅类别较少时） ---------- */

export function DonutChart({
  items,
  size = 140,
}: {
  items: BarItem[]
  size?: number
}) {
  const total = items.reduce((s, i) => s + i.value, 0)
  const r = 54
  const c = 2 * Math.PI * r
  let offset = 0
  const palette = ['var(--tint-strong)', 'var(--tint)', '#9a8f7a', '#6f7d72', '#a4766b', '#7a86a0']
  return (
    <div className="row" style={{ gap: 20 }}>
      <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label="项目占比">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--fill)" strokeWidth="14" />
        {total > 0 &&
          items.map((item, i) => {
            const frac = item.value / total
            const dash = frac * c
            const el = (
              <circle
                key={item.label}
                cx="70"
                cy="70"
                r={r}
                fill="none"
                stroke={item.color || palette[i % palette.length]}
                strokeWidth="14"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            )
            offset += dash
            return el
          })}
      </svg>
      <div>
        {items.map((item, i) => (
          <div key={item.label} className="row small" style={{ gap: 6, marginBottom: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: item.color || palette[i % palette.length],
                flexShrink: 0,
              }}
            />
            <span>{item.label}</span>
            <span className="t3">{total > 0 ? Math.round((item.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
