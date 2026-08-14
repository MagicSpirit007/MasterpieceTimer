/**
 * 统计：日 / 月 / 年 / 自定义。
 * 一张图一个结论：趋势用面积折线，项目比较用条形，类别少时再给环形。
 */
import { useEffect, useMemo, useState } from 'react'
import type { FocusSession, Project } from '../types/models'
import { listProjects } from '../db/repositories/projects'
import { useDataVersion } from '../db/events'
import { computeStats, resolveRange, type StatsPeriod } from '../services/statsService'
import { isNativePickerAvailable, pickDateNative } from '../services/datePicker'
import { BarList, DonutChart, TrendChart } from '../components/charts'

import { SessionEditSheet } from '../components/SessionEditSheet'
import {
  addDays,
  formatDate,
  formatDateTime,
  formatDuration,
  startOfDay,
  startOfMonth,
  startOfYear,
} from '../utils/format'
import ui from '../components/ui.module.css'
import styles from './StatsPage.module.css'

const PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: 'date', label: '日' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
  { value: 'custom', label: '自定义' },
]

type SheetState =
  | { mode: 'create'; defaultProjectId?: string }
  | { mode: 'edit'; session: FocusSession }
  | null

export function StatsPage() {
  const version = useDataVersion()
  const [tick, setTick] = useState(0)
  const [period, setPeriod] = useState<StatsPeriod>('date')
  const [anchor, setAnchor] = useState(() => Date.now())
  const [customStart, setCustomStart] = useState(() => addDays(startOfDay(Date.now()), -6))
  const [customEnd, setCustomEnd] = useState(() => startOfDay(Date.now()))
  const [projects, setProjects] = useState<Project[]>([])
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof computeStats>> | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)

  const range = useMemo(
    () => resolveRange(period, anchor, customStart, customEnd),
    [period, anchor, customStart, customEnd],
  )

  useEffect(() => {
    let alive = true
    void Promise.all([listProjects(true), computeStats(range)]).then(([ps, stats]) => {
      if (!alive) return
      setProjects(ps)
      setSummary(stats)
    })
    return () => {
      alive = false
    }
  }, [range, version, tick])

  const nameOf = (id: string) => projects.find((p) => p.id === id)?.name ?? '已删除项目'
  const colorOf = (id: string) => projects.find((p) => p.id === id)?.color || undefined

  const barItems =
    summary?.byProject.map((p) => ({
      label: nameOf(p.projectId),
      value: p.seconds,
      color: colorOf(p.projectId),
    })) ?? []

  const trendPoints = summary?.trend.map((b) => ({ label: b.label, value: b.hours })) ?? []

  return (
    <div className="page">
      <h1 className="page-title">统计</h1>
      <div className="page-scroll">
        <div className={styles.periodScroll} role="tablist" aria-label="统计范围">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              role="tab"
              aria-selected={period === p.value}
              data-active={period === p.value}
              className={styles.periodChip}
              onClick={() => {
                setPeriod(p.value)
                setAnchor(Date.now())
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'date' && (
          <DateControl
            value={anchor}
            onChange={setAnchor}
            onStep={(dir) => setAnchor(addDays(startOfDay(anchor), dir))}
            label={formatLongDate(anchor)}
            disableNext={startOfDay(anchor) >= startOfDay(Date.now())}
          />
        )}
        {period === 'month' && (
          <DateControl
            value={anchor}
            onChange={setAnchor}
            onStep={(dir) => setAnchor(shiftMonth(anchor, dir))}
            label={formatYearMonth(anchor)}
            disableNext={startOfMonth(anchor) >= startOfMonth(Date.now())}
          />
        )}
        {period === 'year' && (
          <DateControl
            value={anchor}
            onChange={setAnchor}
            onStep={(dir) => setAnchor(shiftYear(anchor, dir))}
            label={`${new Date(anchor).getFullYear()} 年`}
            disableNext={startOfYear(anchor) >= startOfYear(Date.now())}
          />
        )}
        {period === 'custom' && (
          <div className={styles.customRow}>
            <DateInput value={customStart} onChange={setCustomStart} ariaLabel="开始日期" />
            <span className="t3">至</span>
            <DateInput value={customEnd} onChange={setCustomEnd} ariaLabel="结束日期" />
          </div>
        )}

        <div className={`card ${styles.summaryCard}`}>
          <div className={styles.stat}>
            <div className={styles.statValue}>
              {summary ? formatDuration(summary.totalSeconds) : '—'}
            </div>
            <div className={styles.statLabel}>总专注</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{summary?.sessionCount ?? 0}</div>
            <div className={styles.statLabel}>次数</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>
              {summary ? formatDuration(summary.averageSeconds) : '—'}
            </div>
            <div className={styles.statLabel}>平均单次</div>
          </div>
        </div>

        <p className="section-label">专注趋势</p>
        <div className={`card ${styles.chartCard}`}>
          <p className={`t3 xs ${styles.chartNote}`}>单位：小时 · 跨日记录按重叠比例分摊</p>
          {trendPoints.length > 0 ? (
            <TrendChart points={trendPoints} />
          ) : (
            <p className="t3 small">这个范围还没有记录</p>
          )}
        </div>

        <p className="section-label">各项目时长</p>
        <div className={`card ${styles.chartCard}`}>
          {barItems.length > 0 ? (
            <>
              <BarList items={barItems} format={formatDuration} />
              {barItems.length >= 2 && barItems.length <= 5 && (
                <div style={{ marginTop: 20 }}>
                  <DonutChart items={barItems} />
                </div>
              )}
            </>
          ) : (
            <p className="t3 small">没有可比较的项目</p>
          )}
        </div>

        {summary && summary.sessions.length > 0 && (
          <>
            <p className="section-label">本范围记录</p>
            <div className="card">
              {summary.sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={styles.sessionHit}
                  onClick={() => setSheet({ mode: 'edit', session: s })}
                >
                  <div className={ui.listRow}>
                    <div className={styles.sessionMain}>
                      <span>{nameOf(s.projectId)}</span>
                      <span className="xs t3">{formatDateTime(s.startedAt)}</span>
                    </div>
                    <span className="small t2">{formatDuration(s.effectiveSeconds)}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <SessionEditSheet
        open={sheet != null}
        onClose={() => setSheet(null)}
        mode={sheet?.mode ?? 'create'}
        session={sheet?.mode === 'edit' ? sheet.session : undefined}
        defaultProjectId={sheet?.mode === 'create' ? sheet.defaultProjectId : undefined}
        onSaved={() => setTick((t) => t + 1)}
      />
    </div>
  )
}

function DateControl({
  value,
  onChange,
  onStep,
  label,
  disableNext,
}: {
  value: number
  onChange: (ts: number) => void
  onStep: (dir: -1 | 1) => void
  label: string
  disableNext: boolean
}) {
  return (
    <div className={styles.pager}>
      <button className={styles.pagerBtn} aria-label="上一期" onClick={() => onStep(-1)}>
        ‹
      </button>
      {isNativePickerAvailable ? (
        <button
          className={styles.pagerLabel}
          onClick={() =>
            void pickDateNative(value).then(({ ts }) => {
              if (ts != null) onChange(ts)
            })
          }
        >
          {label}
        </button>
      ) : (
        <span className={styles.pagerLabel}>{label}</span>
      )}
      <button
        className={styles.pagerBtn}
        aria-label="下一期"
        disabled={disableNext}
        onClick={() => onStep(1)}
      >
        ›
      </button>
    </div>
  )
}

function DateInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number
  onChange: (ts: number) => void
  ariaLabel: string
}) {
  if (isNativePickerAvailable) {
    return (
      <button
        type="button"
        className={`field ${styles.dateField}`}
        aria-label={ariaLabel}
        onClick={() =>
          void pickDateNative(value).then(({ ts }) => {
            if (ts != null) onChange(startOfDay(ts))
          })
        }
      >
        {formatDate(value)}
      </button>
    )
  }
  return (
    <input
      className={`field ${styles.dateField}`}
      type="date"
      aria-label={ariaLabel}
      value={formatDate(value)}
      onChange={(e) => {
        const ts = new Date(`${e.target.value}T00:00:00`).getTime()
        if (!Number.isNaN(ts)) onChange(ts)
      }}
    />
  )
}

function formatLongDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function formatYearMonth(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

function shiftMonth(ts: number, dir: -1 | 1): number {
  const d = new Date(ts)
  d.setDate(1)
  d.setMonth(d.getMonth() + dir)
  return d.getTime()
}

function shiftYear(ts: number, dir: -1 | 1): number {
  const d = new Date(ts)
  d.setFullYear(d.getFullYear() + dir)
  return d.getTime()
}
