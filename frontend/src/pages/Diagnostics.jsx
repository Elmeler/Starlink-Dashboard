import { useMemo, useState, useEffect } from 'react'
import { Link }            from 'react-router-dom'
import { useLive }         from '../App'
import { useApi }          from '../hooks/useApi'
import ThroughputChart     from '../components/Charts/ThroughputChart'
import LatencyChart        from '../components/Charts/LatencyChart'
import PowerChart          from '../components/Charts/PowerChart'
import { fmtUptime }       from '../utils/fmt'

// ── Alert severity map ────────────────────────────────────────────────────────
const ALERT_SEVERITY = {
  thermal_shutdown:            'error',
  motors_stuck:                'error',
  mast_not_near_vertical:      'warning',
  thermal_throttle:            'warning',
  slow_ethernet_speeds:        'warning',
  water_detected:              'warning',
  unexpected_location:         'warning',
  lower_signal_than_predicted: 'info',
  roaming:                     'info',
  betamember_requires_update:  'info',
  moving_while_not_mobile:     'warning',
  moving_too_fast_for_policy:  'warning',
}

const SEV_STYLE = {
  error:   { bg: 'var(--bad-bg)',  border: 'var(--bad-border)',  color: 'var(--bad)',  dot: 'var(--bad)'  },
  warning: { bg: 'var(--warn-bg)', border: 'var(--warn-border)', color: 'var(--warn)', dot: 'var(--warn)' },
  info:    { bg: 'var(--info-bg)', border: 'var(--info-border)', color: 'var(--info)', dot: 'var(--info)' },
}

const STATE_META = {
  CONNECTED:        { bg: 'var(--good-bg)',  border: 'var(--good-border)', color: 'var(--good)', dot: 'var(--good)', desc: 'Terminal connected — link active' },
  OBSTRUCTED:       { bg: 'var(--warn-bg)',  border: 'var(--warn-border)', color: 'var(--warn)', dot: 'var(--warn)', desc: 'Signal blocked by an obstruction in the sky' },
  THERMAL_SHUTDOWN: { bg: 'var(--bad-bg)',   border: 'var(--bad-border)',  color: 'var(--bad)',  dot: 'var(--bad)',  desc: 'Thermal protection active — dish too hot' },
  SEARCHING:        { bg: 'var(--info-bg)',  border: 'var(--info-border)', color: 'var(--info)', dot: 'var(--info)', desc: 'Searching for satellites' },
  BOOTING:          { bg: 'var(--bg-card)',  border: 'var(--border)',      color: 'var(--text-3)', dot: 'var(--text-4)', desc: 'Terminal is starting up' },
  STOWED:           { bg: 'var(--bg-card)',  border: 'var(--border)',      color: 'var(--text-3)', dot: 'var(--text-4)', desc: 'Terminal is stowed' },
}

function StateBanner({ state }) {
  const m = STATE_META[state] ?? { bg: 'var(--bg-card)', border: 'var(--border)', color: 'var(--text-4)', dot: 'var(--text-4)', desc: 'Unknown state' }
  return (
    <div
      className="rounded-lg px-4 py-3 flex items-center gap-3"
      style={{ background: m.bg, border: `1px solid ${m.border}` }}
    >
      <span style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%', background: m.dot, opacity: 0.25,
          animation: state === 'CONNECTED' ? 'ping 2s ease-out infinite' : undefined,
        }} />
        <span style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: m.dot }} />
      </span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: m.color, letterSpacing: '0.04em' }}>
          {state ?? '—'}
        </p>
        <p style={{ fontSize: 10, color: m.color, opacity: 0.6, marginTop: 1 }}>{m.desc}</p>
      </div>
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Diagnostics() {
  const { data, history } = useLive()
  const { data: diag }    = useApi('/api/diagnostics', 60_000)
  const { data: svcData } = useApi('/api/service',      60_000)

  const { data: seedResp }  = useApi('/api/history',          0)
  const { data: powerResp } = useApi('/api/history?hours=24', 60_000)

  const chartData = useMemo(() => {
    const seed       = seedResp?.data ?? []
    const lastSeedTs = seed.at(-1)?.timestamp ?? 0
    const newLive    = history.filter(p => p.timestamp > lastSeedTs)
    return [...seed, ...newLive].slice(-900)
  }, [seedResp, history])

  const [expandedChart, setExpandedChart] = useState(null)
  useEffect(() => {
    if (!expandedChart) return
    const onKey = e => { if (e.key === 'Escape') setExpandedChart(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expandedChart])

  const d = data ?? {}

  const alerts = d.alerts ?? []

  const disabledCode = svcData?.disablement_code
  const dlRestrict   = svcData?.dl_restricted_reason
  const ulRestrict   = svcData?.ul_restricted_reason
  const isOkEnum     = v => !v || v.startsWith('UNKNOWN') || v === 'OKAY' || v === 'NONE' || v === 'NOT_RESTRICTED' || v === 'NO_LIMIT'
  const showDisabled = !isOkEnum(disabledCode)
  const showDlLimit  = !isOkEnum(dlRestrict)
  const showUlLimit  = !isOkEnum(ulRestrict)
  const hasRestrictions = showDisabled || showDlLimit || showUlLimit

  const azimuth   = diag?.pointing?.azimuth_deg   ?? d.direction_azimuth
  const elevation = diag?.pointing?.elevation_deg ?? d.direction_elevation

  // ── Connection quality stats from history ──────────────────────────────────
  const connStats = useMemo(() => {
    const rows = chartData.filter(r => r.latency_ms != null)
    if (!rows.length) return null

    const lats  = rows.map(r => r.latency_ms)
    const drops = rows.map(r => r.drop_rate_pct ?? 0)

    const avg   = arr => arr.reduce((s, v) => s + v, 0) / arr.length
    const pct   = (arr, p) => {
      const sorted = [...arr].sort((a, b) => a - b)
      return sorted[Math.floor(sorted.length * p / 100)]
    }

    const lossEvents = drops.filter(v => v > 0).length
    const spanMins   = rows.length / 60

    return {
      latAvg:    Math.round(avg(lats)),
      latMin:    Math.round(Math.min(...lats)),
      latMax:    Math.round(Math.max(...lats)),
      latP95:    Math.round(pct(lats, 95)),
      dropAvg:   avg(drops),
      dropMax:   Math.max(...drops),
      lossEvents,
      spanMins:  Math.round(spanMins),
      samples:   rows.length,
    }
  }, [chartData])

  return (
    <div className="space-y-3">

      {/* ══ CHARTS SECTION ══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: 'throughput', node: <ThroughputChart data={chartData} /> },
          { key: 'latency',    node: <LatencyChart    data={chartData} /> },
        ].map(({ key, node }) => (
          <div
            key={key}
            className="rounded-lg p-3 cursor-pointer group"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', transition: 'border-color 0.15s' }}
            onClick={() => setExpandedChart(key)}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            title="Click to expand"
          >
            <div style={{ pointerEvents: 'none' }}>{node}</div>
            <div style={{ textAlign: 'right', marginTop: 4 }}>
              <span style={{ fontSize: 9, color: 'var(--text-6)', letterSpacing: '0.06em' }}>click to expand</span>
            </div>
          </div>
        ))}
      </div>
      <div
        className="rounded-lg p-3 cursor-pointer"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', transition: 'border-color 0.15s' }}
        onClick={() => setExpandedChart('power')}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-border)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        title="Click to expand"
      >
        <div style={{ pointerEvents: 'none' }}>
          <PowerChart data={powerResp?.data ?? []} hours={24} />
        </div>
        <div style={{ textAlign: 'right', marginTop: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--text-6)', letterSpacing: '0.06em' }}>click to expand</span>
        </div>
      </div>

      {/* ══ ACTIVE ALERTS ═══════════════════════════════════════════════════ */}
      <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="label">Active Alerts</p>
          {alerts.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ fontSize: 10, background: 'var(--bad-bg)', color: 'var(--bad)', border: '1px solid var(--bad-border)' }}
            >
              {alerts.length}
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--good)', display: 'inline-block' }} />
            <span style={{ fontSize: 12, color: 'var(--text-4)' }}>No active alerts</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1.5">
              {alerts.map(alert => {
                const sev = ALERT_SEVERITY[alert.key] ?? 'warning'
                const s   = SEV_STYLE[sev]
                return (
                  <span
                    key={alert.key}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-0.5"
                    style={{ fontSize: 11, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                    {alert.label}
                  </span>
                )
              })}
            </div>
            <Link
              to="/alerts"
              style={{ fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap', textDecoration: 'none', flexShrink: 0 }}
            >
              View details →
            </Link>
          </div>
        )}

        {/* Service restrictions */}
        {hasRestrictions && (
          <div className="mt-3 space-y-2">
            {showDisabled && (
              <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                style={{ background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--bad)', flexShrink: 0, marginTop: 3 }} />
                <div>
                  <span style={{ fontSize: 12, color: 'var(--bad)', fontWeight: 600 }}>Terminal disabled</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--bad)', opacity: 0.7, marginLeft: 6 }}>{disabledCode}</span>
                </div>
              </div>
            )}
            {showDlLimit && (
              <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0, marginTop: 3 }} />
                <div>
                  <span style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}>Download restricted</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--warn)', opacity: 0.7, marginLeft: 6 }}>{dlRestrict}</span>
                </div>
              </div>
            )}
            {showUlLimit && (
              <div className="rounded-lg px-3 py-2 flex items-start gap-2"
                style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warn)', flexShrink: 0, marginTop: 3 }} />
                <div>
                  <span style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}>Upload restricted</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--warn)', opacity: 0.7, marginLeft: 6 }}>{ulRestrict}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ DIAGNOSTICS TOOLS ═══════════════════════════════════════════════ */}

        {/* Row 1: Connection Quality */}
        <div
          className="rounded-lg p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <p className="label">Connection Quality</p>
            {connStats && (
              <span style={{ fontSize: 10, color: 'var(--text-6)' }}>
                last {connStats.spanMins} min · {connStats.samples} samples
              </span>
            )}
          </div>

          {!connStats ? (
            <p style={{ fontSize: 11, color: 'var(--text-5)' }}>Collecting data…</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">

              {/* Latency block */}
              <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Latency (ms)
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    ['Min',  connStats.latMin,  connStats.latMin  < 40  ? 'var(--good)' : connStats.latMin  < 80  ? 'var(--warn)' : 'var(--bad)'],
                    ['Avg',  connStats.latAvg,  connStats.latAvg  < 60  ? 'var(--good)' : connStats.latAvg  < 120 ? 'var(--warn)' : 'var(--bad)'],
                    ['P95',  connStats.latP95,  connStats.latP95  < 100 ? 'var(--good)' : connStats.latP95  < 200 ? 'var(--warn)' : 'var(--bad)'],
                    ['Max',  connStats.latMax,  connStats.latMax  < 150 ? 'var(--good)' : connStats.latMax  < 300 ? 'var(--warn)' : 'var(--bad)'],
                  ].map(([lbl, val, col]) => (
                    <div key={lbl} className="flex flex-col items-center">
                      <span style={{ fontSize: 8, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: col, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drop rate block */}
              <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Packet Loss
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    ['Avg %',   (connStats.dropAvg).toFixed(2),  connStats.dropAvg < 0.5  ? 'var(--good)' : connStats.dropAvg < 2    ? 'var(--warn)' : 'var(--bad)'],
                    ['Peak %',  (connStats.dropMax).toFixed(1),  connStats.dropMax < 1    ? 'var(--good)' : connStats.dropMax < 5    ? 'var(--warn)' : 'var(--bad)'],
                    ['Events',  connStats.lossEvents,            connStats.lossEvents < 3 ? 'var(--good)' : connStats.lossEvents < 15 ? 'var(--warn)' : 'var(--bad)'],
                  ].map(([lbl, val, col]) => (
                    <div key={lbl} className="flex flex-col items-center">
                      <span style={{ fontSize: 8, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{lbl}</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: col, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{val}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 9, color: 'var(--text-6)', marginTop: 2 }}>
                  Events = samples where drop rate &gt; 0
                </p>
              </div>

            </div>
          )}
        </div>

        {/* Row 2: signal quality + connection status */}
        <div
          className="rounded-lg p-4 space-y-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p className="label">Signal &amp; Status</p>

          <StateBanner state={d.state ?? diag?.state} />

          <div className="grid grid-cols-2 gap-3">

            {/* Left: signal indicators */}
            <div className="space-y-2">
              {/* SNR */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  SNR above noise floor
                </p>
                <span
                  className="inline-block rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    fontSize: 11,
                    background: d.snr_above_floor === true  ? 'var(--good-bg)'
                              : d.snr_above_floor === false ? 'var(--bad-bg)' : 'var(--bg-card)',
                    color:     d.snr_above_floor === true  ? 'var(--good)'
                              : d.snr_above_floor === false ? 'var(--bad)' : 'var(--text-4)',
                    border:    `1px solid ${d.snr_above_floor === true ? 'var(--good-border)' : d.snr_above_floor === false ? 'var(--bad-border)' : 'var(--border)'}`,
                  }}
                >
                  {d.snr_above_floor === true ? '✓ Above floor' : d.snr_above_floor === false ? '✗ Below floor' : '—'}
                </span>
              </div>

              {/* GPS sats */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  GPS
                </p>
                {d.gps_ready != null ? (
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-block rounded-full px-2 py-0.5 font-semibold"
                      style={{
                        fontSize: 11,
                        background: d.gps_ready ? 'var(--good-bg)' : 'var(--warn-bg)',
                        color:     d.gps_ready ? 'var(--good)' : 'var(--warn)',
                        border:    `1px solid ${d.gps_ready ? 'var(--good-border)' : 'var(--warn-border)'}`,
                      }}
                    >
                      {d.gps_ready ? '✓ Ready' : '○ Not ready'}
                    </span>
                    {d.gps_ready && d.gps_sats != null && (
                      <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {d.gps_sats} sats
                      </span>
                    )}
                  </div>
                ) : <span style={{ fontSize: 11, color: 'var(--text-5)' }}>—</span>}
              </div>

              {/* Dish pointing */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Dish pointing
                </p>
                {azimuth != null && elevation != null ? (
                  <div className="flex gap-3">
                    <div>
                      <span style={{ fontSize: 9, color: 'var(--text-4)' }}>Az</span>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-3)', marginLeft: 4 }}>
                        {azimuth.toFixed(1)}°
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 9, color: 'var(--text-4)' }}>El</span>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-3)', marginLeft: 4 }}>
                        {elevation.toFixed(1)}°
                      </span>
                    </div>
                  </div>
                ) : <span style={{ fontSize: 11, color: 'var(--text-5)' }}>—</span>}
              </div>
            </div>

            {/* Right: terminal identity */}
            <div className="space-y-2">
              {/* Uptime */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Uptime since last boot
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>
                  {fmtUptime(d.uptime_s) ?? <span style={{ color: 'var(--text-5)' }}>—</span>}
                </p>
              </div>

              {/* Software */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Software version
                </p>
                <p className="mono" style={{ fontSize: 11, color: 'var(--info)', wordBreak: 'break-all' }}>
                  {d.software_version ?? <span style={{ color: 'var(--text-5)' }}>—</span>}
                </p>
              </div>

              {/* Hardware */}
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Hardware version
                </p>
                <p className="mono" style={{ fontSize: 11, color: 'var(--text-3)', wordBreak: 'break-all' }}>
                  {d.hardware_version ?? <span style={{ color: 'var(--text-5)' }}>—</span>}
                </p>
              </div>
            </div>

          </div>
        </div>

      {/* ══ CHART EXPAND OVERLAY ════════════════════════════════════════════ */}
      {expandedChart && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' }}
          onClick={() => setExpandedChart(null)}
        >
          <div
            className="rounded-xl p-5 flex flex-col gap-3"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--accent-border)',
              width: 'min(92vw, 960px)',
              boxShadow: '0 0 48px rgba(77,159,255,0.08)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 11, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
                {expandedChart === 'throughput' ? 'Throughput'
               : expandedChart === 'latency'   ? 'Latency & Drop Rate'
               : 'Power'}
              </span>
              <button
                onClick={() => setExpandedChart(null)}
                style={{
                  fontSize: 11, color: 'var(--text-4)', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '2px 8px', borderRadius: 4,
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-1)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-4)'}
              >
                ✕ close
              </button>
            </div>

            {expandedChart === 'throughput' && <ThroughputChart data={chartData}          height={340} />}
            {expandedChart === 'latency'    && <LatencyChart    data={chartData}          height={340} />}
            {expandedChart === 'power'      && <PowerChart      data={powerResp?.data ?? []} hours={24} height={340} />}

            <p style={{ fontSize: 10, color: 'var(--text-6)', textAlign: 'center' }}>
              Click outside or press Esc to close
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
