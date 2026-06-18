import { NavLink } from 'react-router-dom'
import { IconSettings } from '@tabler/icons-react'

export default function Header({ wsConnected, dishConnected, dishAddress }) {
  const dotColor  = !wsConnected ? 'var(--sl-text-lo)' : dishConnected ? 'var(--sl-success)' : 'var(--sl-danger)'
  const dotGlow   = !wsConnected ? 'none'    : dishConnected ? '0 0 6px var(--sl-success)' : '0 0 6px var(--sl-danger)'
  const label     = !wsConnected ? 'Disconnected' : dishConnected ? 'Connected — dish online' : 'Dish unreachable'

  return (
    <header
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: 44,
        background: 'var(--sl-surface)',
        borderBottom: '1px solid var(--sl-border)',
      }}
    >
      {/* Wordmark */}
      <span
        className="font-sans font-medium tracking-widest select-none"
        style={{ fontSize: 13, letterSpacing: 3 }}
      >
        <span className="text-textprimary">STAR</span>
        <span style={{ color: 'var(--sl-accent)' }}>LINK</span>
        <span className="text-textprimary"> MONITOR</span>
      </span>

      {/* Status + IP */}
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

        {dishAddress && (
          <span
            className="mono"
            style={{ fontSize: 11, color: 'var(--sl-text-lo)' }}
          >
            {dishAddress}
          </span>
        )}

        <NavLink
          to="/settings"
          title="Settings"
          className="text-textmuted hover:text-textprimary transition-colors"
        >
          <IconSettings size={16} stroke={1.6} />
        </NavLink>
      </div>
    </header>
  )
}
