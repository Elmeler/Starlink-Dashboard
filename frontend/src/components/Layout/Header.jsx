import { IconSun, IconMoon } from '@tabler/icons-react'
import { useLive } from '../../App'

export default function Header({ wsConnected, dishConnected, dishAddress }) {
  const live = useLive()
  const theme = live?.settings?.theme ?? 'dark'
  const isDark = theme !== 'light'

  const dotColor = !wsConnected ? 'var(--text-4)' : dishConnected ? 'var(--good)' : 'var(--bad)'
  const dotGlow  = !wsConnected ? 'none' : dishConnected ? '0 0 6px var(--good)' : '0 0 6px var(--bad)'
  const label    = !wsConnected ? 'Disconnected' : dishConnected ? 'Connected — dish online' : 'Dish unreachable'

  return (
    <header
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: 44,
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Wordmark */}
      <span
        className="font-sans font-medium tracking-widest select-none"
        style={{ fontSize: 13, letterSpacing: 3 }}
      >
        <span className="text-textprimary">STAR</span>
        <span style={{ color: 'var(--accent)' }}>LINK</span>
        <span className="text-textprimary"> MONITOR</span>
      </span>

      {/* Status + IP + Theme toggle */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-block rounded-full"
            style={{
              width: 7,
              height: 7,
              background: dotColor,
              boxShadow: dotGlow,
              transition: 'background 0.3s, box-shadow 0.3s',
            }}
          />
          <span
            className="font-sans"
            style={{ fontSize: 11, color: dotColor }}
          >
            {label}
          </span>
        </div>

        {/* Theme toggle */}
        <button
          onClick={() => live?.updateSetting('theme', isDark ? 'light' : 'dark')}
          title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '3px 6px',
            cursor: 'pointer',
            color: 'var(--text-4)',
            lineHeight: 0,
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--accent)'
            e.currentTarget.style.borderColor = 'var(--accent-border)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-4)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          {isDark
            ? <IconSun  size={14} stroke={1.8} />
            : <IconMoon size={14} stroke={1.8} />
          }
        </button>
      </div>
    </header>
  )
}
