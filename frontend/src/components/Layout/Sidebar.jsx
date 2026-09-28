import { NavLink } from 'react-router-dom'
import {
  IconActivityHeartbeat,
  IconChartLine,
  IconMap,
  IconDevices,
  IconBell,
  IconSettings,
} from '@tabler/icons-react'
import { useLive } from '../../App'

const NAV = [
  { to: '/',            icon: IconActivityHeartbeat, label: 'Overview'    },
  { to: '/diagnostics', icon: IconChartLine,         label: 'Diagnostics' },
  { to: '/skyview',     icon: IconMap,               label: 'Sky View'    },
  { to: '/devices',     icon: IconDevices,           label: 'Network'     },
  { to: '/alerts',      icon: IconBell,              label: 'Alerts'      },
  { to: '/settings',    icon: IconSettings,          label: 'Settings'    },
]

export default function Sidebar() {
  const live        = useLive()
  const alertCount  = live?.data?.alerts?.length ?? 0

  return (
    <nav
      className="flex flex-col items-center py-3 gap-1 shrink-0"
      style={{ width: 52, background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}
    >
      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          className={({ isActive }) =>
            [
              'flex items-center justify-center rounded-md transition-colors',
              'w-9 h-9',
              isActive
                ? 'text-accent'
                : 'text-textmuted hover:text-[var(--accent-hover)]',
            ].join(' ')
          }
          style={({ isActive }) =>
            isActive ? { background: 'var(--accent-bg)' } : undefined
          }
        >
          {({ isActive }) => (
            <span style={{ position: 'relative', lineHeight: 0 }}>
              <Icon
                size={20}
                stroke={1.6}
                color={isActive ? 'var(--accent)' : undefined}
              />
              {to === '/alerts' && alertCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -4,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--bad)',
                  border: '1.5px solid var(--bg-card)',
                  boxShadow: '0 0 5px rgba(239,68,68,0.6)',
                }} />
              )}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
