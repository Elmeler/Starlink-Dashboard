import { useMemo } from 'react'
import { useLive }       from '../App'
import { useApi }        from '../hooks/useApi'
import ObstructionMap    from '../components/ObstructionMap'
import SatelliteTracker  from '../components/SatelliteTracker'
import TempGauge         from '../components/TempGauge'

// ── small helpers ─────────────────────────────────────────────────────────────

function StatRow({ label, children }) {
  return (
    <div
      className="flex justify-between items-center py-1.5"
      style={{ borderBottom: `0.5px solid var(--sl-border-subtle)` }}
    >
      <span style={{ fontSize: 10, color: 'var(--sl-text-lo)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'var(--sl-text-med)' }}>{children}</span>
    </div>
  )
}

function StateBadge({ state }) {
  const colors = {
    CONNECTED:        { bg: 'var(--sl-success-dim)', color: 'var(--sl-success)' },
    OBSTRUCTED:       { bg: 'var(--sl-warning-dim)', color: 'var(--sl-warning)' },
    THERMAL_SHUTDOWN: { bg: 'var(--sl-danger-dim)',  color: 'var(--sl-danger)'  },
    SEARCHING:        { bg: 'var(--sl-accent-bg)',   color: 'var(--sl-accent)'  },
    BOOTING:          { bg: 'var(--sl-border)',      color: 'var(--sl-text-lo)' },
    STOWED:           { bg: 'var(--sl-border)',      color: 'var(--sl-text-lo)' },
  }
  const sty = colors[state] ?? { bg: 'var(--sl-border)', color: 'var(--sl-text-lo)' }
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 font-medium"
      style={{ fontSize: 10, background: sty.bg, color: sty.color }}
    >
      {state ?? '—'}
    </span>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Diagnostics() {
  const { data, history } = useLive()
  const { data: diag }    = useApi('/api/diagnostics', 60_000)

  const pointingHistory = useMemo(() =>
    history
      .slice(-90)
      .filter(h => h.direction_azimuth != null && h.direction_elevation != null)
      .map(h => ({ azimuth: h.direction_azimuth, elevation: h.direction_elevation })),
    [history]
  )

  const d = data ?? {}

  const dishTemp  = diag?.dish_temp_c  ?? d.dish_temp_c
  const boardTemp = diag?.board_temp_c ?? d.board_temp_c
  const azimuth   = diag?.pointing?.azimuth_deg   ?? d.direction_azimuth
  const elevation = diag?.pointing?.elevation_deg ?? d.direction_elevation

  return (
    <div className="flex gap-3 min-h-0">

      {/* ══ LEFT PANEL — large obstruction map ══════════════════════════════ */}
      <div
        className="rounded-lg p-4 flex flex-col gap-3 shrink-0"
        style={{ width: 300, background: 'var(--sl-surface)', border: '1px solid var(--sl-border)' }}
      >
        <p className="label">Obstruction Map</p>

        <div className="flex justify-center">
          <ObstructionMap
            mapData={diag?.obstruction_map}
            azimuth={azimuth}
            elevation={elevation}
            size={260}
            showLegend
          />
        </div>

        {/* Obstruction stats */}
        <div>
          <StatRow label="Obstructed">
            {diag?.is_obstructed != null ? (
              <span style={{ color: diag.is_obstructed ? 'var(--sl-warning)' : 'var(--sl-success)' }}>
                {diag.is_obstructed ? 'Yes' : 'No'}
              </span>
            ) : '—'}
          </StatRow>
          <StatRow label="Fraction blocked">
            {diag?.fraction_obstructed_pct != null
              ? `${diag.fraction_obstructed_pct.toFixed(1)} %`
              : '—'}
          </StatRow>
        </div>
      </div>

      {/* ══ RIGHT PANEL — tracker + gauges + status ═════════════════════════ */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">

        {/* Row 1: satellite tracker + temperature gauges */}
        <div
          className="rounded-lg p-4 flex flex-wrap gap-6 items-start justify-around"
          style={{ background: 'var(--sl-surface)', border: '1px solid var(--sl-border)' }}
        >
          <div className="flex flex-col items-center gap-1">
            <p className="label mb-2">Satellite Tracker</p>
            <SatelliteTracker
              azimuth={azimuth}
              elevation={elevation}
              history={pointingHistory}
              size={150}
            />
          </div>

          <div className="flex flex-col gap-1">
            <p className="label mb-2">Temperatures</p>
            <div className="flex gap-4">
              <TempGauge label="Dish"  value={dishTemp}  size={120} />
              <TempGauge label="Board" value={boardTemp} size={120} />
            </div>
          </div>
        </div>

        {/* Row 2: signal quality + connection status */}
        <div
          className="rounded-lg p-4"
          style={{ background: 'var(--sl-surface)', border: '1px solid var(--sl-border)' }}
        >
          <p className="label mb-3">Signal &amp; Status</p>

          {/* SNR indicator — segmented bar */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 10, color: 'var(--sl-text-lo)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                SNR above noise floor
              </span>
              <span style={{
                fontSize: 10, fontWeight: 500,
                color: d.snr_above_floor === true  ? 'var(--sl-success)'
                     : d.snr_above_floor === false ? 'var(--sl-danger)'
                     : 'var(--sl-text-dim)',
              }}>
                {d.snr_above_floor === true  ? 'Yes'
                : d.snr_above_floor === false ? 'No'
                : '—'}
              </span>
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 6, background: 'var(--sl-border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: d.snr_above_floor ? '100%' : d.snr_above_floor === false ? '15%' : '0%',
                  background: d.snr_above_floor ? 'var(--sl-success)' : 'var(--sl-danger)',
                }}
              />
            </div>
          </div>

          <div>
            <StatRow label="State">
              <StateBadge state={d.state ?? diag?.state} />
            </StatRow>
            <StatRow label="GPS">
              {d.gps_ready != null ? (
                <span style={{ color: d.gps_ready ? 'var(--sl-success)' : 'var(--sl-warning)' }}>
                  {d.gps_ready ? `Ready — ${d.gps_sats ?? '?'} sats` : 'Not ready'}
                </span>
              ) : '—'}
            </StatRow>
            <StatRow label="Pointing">
              {azimuth != null && elevation != null
                ? <span className="mono" style={{ fontSize: 11 }}>
                    Az {azimuth.toFixed(1)}°  El {elevation.toFixed(1)}°
                  </span>
                : '—'}
            </StatRow>
            <StatRow label="Uptime">
              {(() => {
                const s = d.uptime_s
                if (!s) return '—'
                const d2 = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600)
                const m = Math.floor((s % 3600) / 60)
                return d2 > 0 ? `${d2}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
              })()}
            </StatRow>
            <StatRow label="Software">
              <span className="mono" style={{ fontSize: 10, color: 'var(--sl-text-lo)' }}>
                {d.software_version ?? '—'}
              </span>
            </StatRow>
            <StatRow label="Hardware">
              <span className="mono" style={{ fontSize: 10, color: 'var(--sl-text-lo)' }}>
                {d.hardware_version ?? '—'}
              </span>
            </StatRow>
          </div>
        </div>
      </div>
    </div>
  )
}
