/** 一级导航：首页 / 统计 / 展览 / 我的。进入专注页时整页隐藏。 */
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import styles from './ui.module.css'

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

const TABS = [
  { to: '/', label: '首页', icon: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5' },
  { to: '/stats', label: '统计', icon: 'M4 20V10m6 10V4m6 16v-7m4 7H2' },
  { to: '/gallery', label: '展览', icon: 'M4 5h16v12H4zM4 13l4-4 4 4 3-3 5 5M9 8.5h.01' },
  { to: '/me', label: '我的', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5' },
] as const

export function TabBar() {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    let last = 0
    const onScroll = (e: Event) => {
      const t = e.target
      if (!(t instanceof HTMLElement) || !t.classList.contains('page-scroll')) return
      const y = t.scrollTop
      setCompact(y > last + 2 && y > 28)
      last = y
    }
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  }, [])

  return (
    <nav className={styles.tabbar} data-compact={compact} aria-label="主导航">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={styles.tab}
          aria-label={t.label}
        >
          {({ isActive }) => (
            <span data-active={isActive} className={styles.tabInner}>
              <Icon d={t.icon} />
              <span className={styles.tabLabel}>{t.label}</span>
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
