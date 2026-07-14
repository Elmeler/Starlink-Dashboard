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
      style={{ background: '#7c2d12', border: '1px solid #c2410c' }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <IconAlertTriangle size={16} stroke={2} style={{ color: '#fb923c', flexShrink: 0, marginTop: 1 }} />
        <div className="flex-1 min-w-0">
          <p className="font-medium" style={{ fontSize: 13, color: '#fed7aa' }}>{alert.label}</p>
          <p style={{ fontSize: 10, color: '#c2410c', marginTop: 2 }}>
            Active since {fmtTime(alert.startTime)}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={() => onDismiss(alert.key)}
            className="hover:opacity-70 transition-opacity"
            style={{ color: '#fb923c', lineHeight: 0, flexShrink: 0 }}
            aria-label="Dismiss"
          >
            <IconX size={14} stroke={2} />
          </button>
        )}
      </div>

      {/* Description */}
      {meta?.description && (
        <p style={{ fontSize: 12, color: '#fcd9aa', lineHeight: 1.55, paddingLeft: 27 }}>
          {meta.description}
        </p>
      )}

      {/* Actions */}
      {meta?.actions?.length > 0 && (
        <ul className="space-y-1.5" style={{ paddingLeft: 27 }}>
          {meta.actions.map((action, i) => (
            <li key={i} className="flex gap-2">
              <IconChevronRight size={11} stroke={2} style={{ color: '#c2410c', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12, color: '#fed7aa', lineHeight: 1.45 }}>{action}</span>
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
            style={{ fontSize: 11, background: '#3b0c0c', color: '#fb923c', border: '1px solid #7c2d12' }}
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
  const historyAlerts = alertLog  // newest first from useAlertLog

  return (
    <div className="space-y-4 max-w-3xl">

      {/* ── Active alerts ── */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <p className="label">Active Alerts</p>
          {activeAlerts.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ fontSize: 10, background: '#7c2d12', color: '#fb923c' }}
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
            style={{ background: '#0d1017', border: '1px solid #1e2330' }}
          >
            <IconCircleCheck size={18} stroke={1.5} style={{ color: '#22c55e' }} />
            <p style={{ fontSize: 13, color: '#4a5568' }}>No active alerts — all systems nominal</p>
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
                style={{ fontSize: 10, background: '#1e2330', color: '#4a5568' }}
              >
                {historyAlerts.length}
              </span>
            )}
          </div>
          {historyAlerts.length > 0 && (
            <button
              onClick={clearLog}
              className="flex items-center gap-1 hover:opacity-70 transition-opacity"
              style={{ fontSize: 10, color: '#4a5568' }}
            >
              <IconTrash size={11} stroke={1.5} />
              Clear history
            </button>
          )}
        </div>

        {historyAlerts.length === 0 ? (
          <div
            className="rounded-lg px-4 py-5 text-center"
            style={{ background: '#0d1017', border: '1px solid #1e2330' }}
          >
            <p style={{ fontSize: 12, color: '#2a3344' }}>
              No alert history yet — alerts will be recorded here when they occur
            </p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1e2330' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#111520', borderBottom: '1px solid #1e2330' }}>
                  {['Time', 'Alert', 'Duration', 'Status'].map(h => (
                    <th
                      key={h}
                      className="text-left"
                      style={{ padding: '7px 12px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a5568' }}
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
                      style={{ borderTop: i === 0 ? 'none' : '0.5px solid #1a2030' }}
                    >
                      {/* Time */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: '#4a5568' }}>
                          {fmtDate(entry.startTime)}
                        </span>
                      </td>

                      {/* Alert label */}
                      <td style={{ padding: '8px 12px' }}>
                        <div className="flex items-center gap-2">
                          <IconAlertTriangle
                            size={12} stroke={2}
                            style={{ color: isActive ? '#fb923c' : '#4a5568', flexShrink: 0 }}
                          />
                          <span style={{ fontSize: 12, color: isActive ? '#fed7aa' : '#cbd5e1' }}>
                            {entry.label}
                          </span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: '#4a5568' }}>
                          {fmtDuration(entry.startTime, entry.endTime)}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '8px 12px' }}>
                        {isActive ? (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: '#7c2d12', color: '#fb923c' }}
                          >
                            <span
                              className="inline-block rounded-full"
                              style={{ width: 5, height: 5, background: '#fb923c' }}
                            />
                            Active
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: '#0a3320', color: '#22c55e' }}
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
                style={{ fontSize: 10, background: '#1e2330', color: '#4a5568' }}
              >
                {outageLog.length}
              </span>
            )}
          </div>
          {outageLog?.length > 0 && (
            <button
              onClick={clearOutageLog}
              className="flex items-center gap-1 hover:opacity-70 transition-opacity"
              style={{ fontSize: 10, color: '#4a5568' }}
            >
              <IconTrash size={11} stroke={1.5} />
              Clear
            </button>
          )}
        </div>

        {!outageLog?.length ? (
          <div
            className="rounded-lg px-4 py-5 text-center"
            style={{ background: '#0d1017', border: '1px solid #1e2330' }}
          >
            <p style={{ fontSize: 12, color: '#2a3344' }}>
              No outages recorded — disconnections will appear here
            </p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #1e2330' }}>
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#111520', borderBottom: '1px solid #1e2330' }}>
                  {['Started', 'Cause', 'Duration', 'Status'].map(h => (
                    <th
                      key={h}
                      className="text-left"
                      style={{ padding: '7px 12px', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#4a5568' }}
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
                    <tr key={entry.id} style={{ borderTop: i === 0 ? 'none' : '0.5px solid #1a2030' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: '#4a5568' }}>
                          {fmtDate(entry.startTime)}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span
                          className="inline-block rounded px-1.5 py-0.5 mono"
                          style={{ fontSize: 10, background: '#1e2330', color: '#94a3b8' }}
                        >
                          {entry.cause}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                        <span className="mono" style={{ fontSize: 11, color: '#4a5568' }}>
                          {fmtDuration(entry.startTime, entry.endTime)}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        {isActive ? (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: '#3b0c0c', color: '#ef4444' }}
                          >
                            <span className="inline-block rounded-full" style={{ width: 5, height: 5, background: '#ef4444' }} />
                            Offline
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                            style={{ fontSize: 10, background: '#0a3320', color: '#22c55e' }}
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
