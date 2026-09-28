import { useState } from 'react'
import { IconAlertTriangle, IconCircleCheck, IconTrash, IconX, IconRefresh, IconChevronRight } from '@tabler/icons-react'
import { useLive } from '../App'
import { ALERT_META } from '../utils/alertMeta'
import { useRebootDish } from '../hooks/useRebootDish'

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
  const meta = ALERT_META[alert.key]
  const { state: res, reboot } = useRebootDish()
  const busy = res === 'busy'

  return (
    <div
      className="rounded-lg px-4 py-3 space-y-2.5"
      style={{ background: 'var(--alert-bg)', border: '1px solid var(--alert-border)' }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <IconAlertTriangle size={16} stroke={2} style={{ color: 'var(--alert-accent)', flexShrink: 0, marginTop: 1 }} />
        <div className="flex-1 min-w-0">
          <p className="font-medium" style={{ fontSize: 13, color: 'var(--alert-text)' }}>{alert.label}</p>
          <p style={{ fontSize: 10, color: 'var(--alert-border)', marginTop: 2 }}>
            Active since {fmtTime(alert.startTime)}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(alert.key)}
            className="hover:opacity-70 transition-opacity"
            style={{ color: 'var(--alert-accent)', lineHeight: 0, flexShrink: 0 }}
            aria-label="Dismiss"
          >
            <IconX size={14} stroke={2} />
          </button>
        )}
      </div>

      {/* Description */}
      {meta?.description && (
        <p style={{ fontSize: 12, color: 'var(--alert-sub)', lineHeight: 1.55, paddingLeft: 27 }}>
          {meta.description}
        </p>
      )}

      {/* Actions */}
      {meta?.actions?.length > 0 && (
        <ul className="space-y-1.5" style={{ paddingLeft: 27 }}>
          {meta.actions.map((action, i) => (
            <li key={i} className="flex gap-2">
              <IconChevronRight size={11} stroke={2} style={{ color: 'var(--alert-border)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: 'var(--alert-text)', lineHeight: 1.45 }}>{action}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Reboot button */}
      {meta?.canReboot && (
        <div style={{ paddingLeft: 27 }}>
          <button
            onClick={reboot}
            disabled={busy}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 font-medium transition-opacity disabled:opacity-50"
            style={{ fontSize: 11, background: 'var(--bad-bg)', color: 'var(--alert-accent)', border: '1px solid var(--alert-bg)' }}
          >
            {busy
              ? <IconRefresh size={11} stroke={2} className="animate-spin" />
              : <IconRefresh size={11} stroke={2} />}
            {res === 'ok' ? 'Rebooting…' : res === 'err' ? 'Reboot failed' : 'Reboot dish'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Alerts() {
  const { data, alertLog, clearLog, outageLog, clearOutageLog } = useLive()
  const [dismissed, setDismissed] = useState(new Set())

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
              style={{ fontSize: 10, background: 'var(--alert-bg)', color: 'var(--alert-accent)' }}
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
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <IconCircleCheck size={18} stroke={1.5} style={{ color: 'var(--good)' }} />
            <p style={{ fontSize: 13, color: 'var(--text-4)' }}>No active alerts — all systems nominal</p>
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
                style={{ fontSize: 10, background: 'var(--border)', color: 'var(--text-4)' }}
              >
                {historyAlerts.length}
              </span>
            )}
          </div>
          {historyAlerts.length > 0 && (
            <button
              onClick={clearLog}
              className="flex items-center gap-1 hover:opacity-70 transition-opacity"
              style={{ fontSize: 10, color: 'var(--text-4)' }}
            >
              <IconTrash size={11} stroke={1.5} />
              Clear history
            </button>
          )}
        </div>

        {historyAlerts.length === 0 ? (
          <div
            className="rounded-lg px-4 py-5 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p style={{ fontSize: 12, color: 'var(--text-5)' }}>
              No alert history yet — alerts will be recorded here when they occur
            </p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--tbl-head)', borderBottom: '1px solid var(--border)' }}>
                  {['Time', 'Alert', 'Duration', 'Status'].map(h => (
                    <th
                      key={h}
                      className="text-left"
                      style={{ padding: '7px 12px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)' }}
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
                      style={{ borderTop: i === 0 ? 'none' : '0.5px solid var(--border-dim)' }}
                    >
                      {/* Time */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                          {fmtDate(entry.startTime)}
                        </span>
                      </td>

                      {/* Alert label */}
                      <td style={{ padding: '8px 12px' }}>
                        <div className="flex items-center gap-2">
                          <IconAlertTriangle
                            size={12} stroke={2}
                            style={{ color: isActive ? 'var(--alert-accent)' : 'var(--text-4)', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 12, color: isActive ? 'var(--alert-text)' : 'var(--text-2)' }}>
                            {entry.label}
                          </span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                          {fmtDuration(entry.startTime, entry.endTime)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '8px 12px' }}>
                        {isActive ? (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: 'var(--alert-bg)', color: 'var(--alert-accent)' }}
                          >
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 5, height: 5, background: 'var(--alert-accent)' }}
                            />
                            Active
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: 'var(--good-bg)', color: 'var(--good)' }}
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

      {/* ── Outage log ── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="label">Outage History</p>
            {outageLog?.length > 0 && (
              <span
                className="rounded-full px-2 py-0.5"
                style={{ fontSize: 10, background: 'var(--border)', color: 'var(--text-4)' }}
              >
                {outageLog.length}
              </span>
            )}
          </div>
          {outageLog?.length > 0 && (
            <button
              onClick={clearOutageLog}
              className="flex items-center gap-1 hover:opacity-70 transition-opacity"
              style={{ fontSize: 10, color: 'var(--text-4)' }}
            >
              <IconTrash size={11} stroke={1.5} />
              Clear
            </button>
          )}
        </div>

        {!outageLog?.length ? (
          <div
            className="rounded-lg px-4 py-5 text-center"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
          >
            <p style={{ fontSize: 12, color: 'var(--text-5)' }}>
              No outages recorded — disconnections will appear here
            </p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--tbl-head)', borderBottom: '1px solid var(--border)' }}>
                  {['Started', 'Cause', 'Duration', 'Status'].map(h => (
                    <th
                      key={h}
                      className="text-left"
                      style={{ padding: '7px 12px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outageLog.map((entry, i) => {
                  const isActive = entry.endTime == null
                  return (
                    <tr key={entry.id} style={{ borderTop: i === 0 ? 'none' : '0.5px solid var(--border-dim)' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                          {fmtDate(entry.startTime)}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          className="inline-block rounded px-1.5 py-0.5 mono"
                          style={{ fontSize: 10, background: 'var(--border)', color: 'var(--text-3)' }}
                        >
                          {entry.cause}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                          {fmtDuration(entry.startTime, entry.endTime)}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {isActive ? (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: 'var(--bad-bg)', color: 'var(--bad)' }}
                          >
                            <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: 'var(--bad)' }} />
                            Offline
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: 'var(--good-bg)', color: 'var(--good)' }}
                          >
                            <IconCircleCheck size={10} stroke={2} />
                            Restored
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
