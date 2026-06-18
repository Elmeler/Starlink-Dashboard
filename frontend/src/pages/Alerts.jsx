import { useState } from 'react'
import { IconAlertTriangle, IconCircleCheck, IconTrash, IconX } from '@tabler/icons-react'
import { useLive } from '../App'

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtTime(ms) {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(ms) {
  if (!ms) return '—'
  const d = new Date(ms)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(startMs, endMs) {
  const ms = (endMs ?? Date.now()) - startMs
  if (ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0)  return `${h}h ${m % 60}m`
  if (m > 0)  return `${m}m ${s % 60}s`
  return `${s}s`
}

// ── active alert card ─────────────────────────────────────────────────────────

function ActiveCard({ alert, onDismiss }) {
  return (
    <div
      className="flex items-start gap-3 rounded-lg px-4 py-3"
      style={{ background: 'var(--sl-alert-bg)', border: '1px solid var(--sl-alert-border)' }}
    >
      <IconAlertTriangle size={16} stroke={2} style={{ color: 'var(--sl-alert-icon)', flexShrink: 0, marginTop: 1 }} />
      <div className="flex-1 min-w-0">
        <p className="font-medium" style={{ fontSize: 13, color: 'var(--sl-alert-text)' }}>{alert.label}</p>
        <p style={{ fontSize: 10, color: 'var(--sl-alert-border)', marginTop: 2 }}>
          Active since {fmtTime(alert.startTime)}
        </p>
      </div>
      {onDismiss && (
        <button
          onClick={() => onDismiss(alert.key)}
          className="hover:opacity-70 transition-opacity"
          style={{ color: 'var(--sl-alert-icon)', lineHeight: 0, flexShrink: 0 }}
          aria-label="Dismiss"
        >
          <IconX size={14} stroke={2} />
        </button>
      )}
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Alerts() {
  const { data, alertLog, clearLog } = useLive()
  const [dismissed, setDismissed]    = useState(new Set())

  const activeAlerts  = (data?.alerts ?? []).filter(a => !dismissed.has(a.key))
  const historyAlerts = alertLog

  return (
    <div className="space-y-4 max-w-3xl">

      {/* ── Active alerts ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <p className="label">Active Alerts</p>
          {activeAlerts.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ fontSize: 10, background: 'var(--sl-alert-bg)', color: 'var(--sl-alert-icon)' }}
            >
              {activeAlerts.length}
            </span>
          )}
        </div>

        {activeAlerts.length > 0 ? (
          <div className="space-y-1.5">
            {activeAlerts.map(a => (
              <ActiveCard
                key={a.key}
                alert={{
                  ...a,
                  startTime: alertLog.find(e => e.key === a.key && e.endTime == null)?.startTime,
                }}
                onDismiss={key => setDismissed(prev => new Set([...prev, key]))}
              />
            ))}
          </div>
        ) : (
          <div
            className="rounded-lg px-4 py-5 flex items-center gap-3"
            style={{ background: 'var(--sl-surface)', border: '1px solid var(--sl-border)' }}
          >
            <IconCircleCheck size={18} stroke={1.5} style={{ color: 'var(--sl-success)' }} />
            <p style={{ fontSize: 13, color: 'var(--sl-text-lo)' }}>No active alerts — all systems nominal</p>
          </div>
        )}
      </section>

      {/* ── History log ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="label">Alert History</p>
            {historyAlerts.length > 0 && (
              <span
                className="rounded-full px-2 py-0.5"
                style={{ fontSize: 10, background: 'var(--sl-border)', color: 'var(--sl-text-lo)' }}
              >
                {historyAlerts.length}
              </span>
            )}
          </div>
          {historyAlerts.length > 0 && (
            <button
              onClick={clearLog}
              className="flex items-center gap-1 hover:opacity-70 transition-opacity"
              style={{ fontSize: 10, color: 'var(--sl-text-lo)' }}
            >
              <IconTrash size={11} stroke={1.5} />
              Clear history
            </button>
          )}
        </div>

        {historyAlerts.length === 0 ? (
          <div
            className="rounded-lg px-4 py-5 text-center"
            style={{ background: 'var(--sl-surface)', border: '1px solid var(--sl-border)' }}
          >
            <p style={{ fontSize: 12, color: 'var(--sl-text-dim)' }}>
              No alert history yet — alerts will be recorded here when they occur
            </p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--sl-border)' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--sl-surface-alt)', borderBottom: '1px solid var(--sl-border)' }}>
                  {['Time', 'Alert', 'Duration', 'Status'].map(h => (
                    <th
                      key={h}
                      className="text-left"
                      style={{ padding: '7px 12px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sl-text-lo)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyAlerts.map((entry, i) => {
                  const isActive = entry.endTime == null
                  return (
                    <tr
                      key={entry.id}
                      style={{ borderTop: i === 0 ? 'none' : `0.5px solid var(--sl-border-subtle)` }}
                    >
                      {/* Time */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--sl-text-lo)' }}>
                          {fmtDate(entry.startTime)}
                        </span>
                      </td>

                      {/* Alert label */}
                      <td style={{ padding: '8px 12px' }}>
                        <div className="flex items-center gap-2">
                          <IconAlertTriangle
                            size={12} stroke={2}
                            style={{ color: isActive ? 'var(--sl-alert-icon)' : 'var(--sl-text-lo)', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 12, color: isActive ? 'var(--sl-alert-text)' : 'var(--sl-text-med)' }}>
                            {entry.label}
                          </span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--sl-text-lo)' }}>
                          {fmtDuration(entry.startTime, entry.endTime)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '8px 12px' }}>
                        {isActive ? (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: 'var(--sl-alert-bg)', color: 'var(--sl-alert-icon)' }}
                          >
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 5, height: 5, background: 'var(--sl-alert-icon)' }}
                            />
                            Active
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: 'var(--sl-success-dim)', color: 'var(--sl-success)' }}
                          >
                            <IconCircleCheck size={10} stroke={2} />
                            Resolved
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
