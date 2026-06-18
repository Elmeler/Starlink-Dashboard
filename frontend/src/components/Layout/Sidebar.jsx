import { NavLink } from 'react-router-dom'
import {
  IconLayoutDashboard,
  IconRadar,
  IconDevices,
  IconBell,
  IconSettings,
} from '@tabler/icons-react'

const NAV = [
  { to: '/',            icon: IconLayoutDashboard, label: 'Dashboard'   },
  { to: '/diagnostics', icon: IconRadar,            label: 'Diagnostics' },
  { to: '/devices',     icon: IconDevices,          label: 'Devices'     },
  { to: '/alerts',      icon: IconBell,             label: 'Alerts'      },
  { to: '/settings',    icon: IconSettings,         label: 'Settings'    },
]

export default function Sidebar() {
  return (
    <nav
      className="flex flex-col items-center py-3 gap-1 shrink-0"
      style={{ width: 52, background: 'var(--sl-surface)', borderRight: '1px solid var(--sl-border)' }}
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
                : 'text-textmuted hover:text-textprimary',
            ].join(' ')
          }
          style={({ isActive }) =>
            isActive ? { background: 'var(--sl-accent-bg)' } : undefined
          }
        >
          {({ isActive }) => (
            <Icon
              size={20}
              stroke={1.6}
              color={isActive ? 'var(--sl-accent)' : undefined}
            />
          )}
        </NavLink>
      ))}
    </nav>
  )
}
