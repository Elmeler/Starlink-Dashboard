import { useState, useRef, useCallback } from 'react'
import { IconAlertTriangle, IconX, IconRefresh, IconChevronRight } from '@tabler/icons-react'
import { ALERT_META } from '../../utils/alertMeta'
import { useRebootDish } from '../../hooks/useRebootDish'

// ── hover card ────────────────────────────────────────────────────────────────

function HoverCard({ alert, meta }) {
  const { state: rebootState, reboot } = useRebootDish()

  return (
    <div
      className="absolute z-50 rounded-lg p-3 space-y-2.5"
      style={{
        top: '100%',
        left: 0,
        marginTop: 6,
        width: 340,
        background: '#111520',
        border: '1px solid #c2410c',
        boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
        pointerEvents: 'auto',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <IconAlertTriangle size={13} stroke={2} style={{ color: '#fb923c', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#fed7aa' }}>{alert.label}</span>
      </div>

      {/* Description */}
      {meta?.description && (
        <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.55 }}>
          {meta.description}
        </p>
      )}

      {/* Actions */}
      {meta?.actions?.length > 0 && (
        <div>
          <p style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
            Suggested actions
          </p>
          <ul className="space-y-1.5">
            {meta.actions.map((action, i) => (
              <li key={i} className="flex gap-2">
                <IconChevronRight size={11} stroke={2} style={{ color: '#4a5568', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.45 }}>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reboot button */}
      {meta?.canReboot && (
        <div className="pt-1" style={{ borderTop: '1px solid #1e2330' }}>
          <button
            onClick={reboot}
            disabled={rebootState === 'busy'}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-opacity disabled:opacity-50"
            style={{ fontSize: 11, background: '#3b0c0c', color: '#fb923c', border: '1px solid #7c2d12' }}
          >
            {rebootState === 'busy'
              ? <IconRefresh size={11} stroke={2} className="animate-spin" />
              : <IconRefresh size={11} stroke={2} />}
            {rebootState === 'ok'  ? 'Rebooting…'  :
             rebootState === 'err' ? 'Reboot failed' : 'Reboot dish'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function AlertBanner({ alerts = [], dismissed = new Set(), onDismiss }) {
  const visible = alerts.filter(a => !dismissed.has(a.key))
  const [hoveredKey,   setHoveredKey]   = useState(null)
  const leaveTimer = useRef(null)

  const handleMouseEnter = useCallback((key) => {
    clearTimeout(leaveTimer.current)
    setHoveredKey(key)
  }, [])

  const handleMouseLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setHoveredKey(null), 200)
  }, [])

  if (!visible.length) return null

  return (
    <div className="flex flex-col gap-1 mb-3">
      {visible.map(alert => {
        const meta     = ALERT_META[alert.key]
        const isHovered = hoveredKey === alert.key

        return (
          <div
            key={alert.key}
            className="relative flex items-center gap-2 rounded-md px-3 py-2"
            style={{ background: '#7c2d12', border: '1px solid #c2410c' }}
            onMouseLeave={handleMouseLeave}
          >
            {/* Icon — hover target */}
            <div
              className="shrink-0 cursor-default"
              onMouseEnter={() => handleMouseEnter(alert.key)}
              style={{ lineHeight: 0 }}
            >
              <IconAlertTriangle size={15} stroke={2} style={{ color: '#fb923c' }} />
            </div>

            {/* Label */}
            <span className="flex-1 text-sm font-medium" style={{ color: '#fed7aa' }}>
              {alert.label}
            </span>

            {/* Dismiss */}
            {onDismiss && (
              <button
                onClick={() => onDismiss(alert.key)}
                className="hover:opacity-70 transition-opacity"
                style={{ color: '#fb923c', lineHeight: 0 }}
                aria-label="Dismiss"
              >
                <IconX size={14} stroke={2} />
              </button>
            )}

            {/* Hover card */}
            {isHovered && meta && (
              <HoverCard alert={alert} meta={meta} />
            )}
          </div>
        )
      })}
    </div>
  )
}
