import { useMemo, useState, useCallback } from 'react'
import { useLive }       from '../App'
import { useApi }        from '../hooks/useApi'
import ObstructionMap    from '../components/ObstructionMap'
import SatelliteTracker  from '../components/SatelliteTracker'
import TempGauge         from '../components/TempGauge'

// ── GPS panel ─────────────────────────────────────────────────────────────────

const REASON_MSG = {
  PERMISSION_DENIED: {
    text: 'The dish requires authorisation from the Starlink app before it will share location data. The API toggle below may not be sufficient on its own.',
    hint: 'After clicking Enable GPS, also open the Starlink app → Settings and confirm GPS / location sharing is on there.',
    color: '#f59e0b',
  },
  NO_FIX: {
    text: 'GPS hardware is working but has not obtained a position fix yet.',
    hint: 'This usually resolves within 1–2 minutes of the dish powering on outdoors.',
    color: '#4d9fff',
  },
  GPS_NOT_VALID: {
    text: 'GPS hardware is not reporting a valid satellite fix.',
    hint: 'Check that the dish has a clear view of the sky.',
    color: '#ef4444',
  },
  GRPC_ERROR: {
    text: 'A communication error occurred while reading location data.',
    hint: 'Check the backend logs for details.',
    color: '#ef4444',
  },
}

function GpsPanel({ gps, onEnable, onDisable, busy, result, errMsg, apiResponse }) {
  const enabled = gps?.enabled
  const reason  = gps?.reason
  const reasonInfo = reason ? REASON_MSG[reason] : null

  // Hardware status row — shown in both states
  const HwStatus = () => (
    <div
      className="rounded-lg p-3 flex items-center justify-between"
      style={{ background: '#0a0c10', border: '1px solid #1e2330' }}
    >
      <div>
        <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
          GPS hardware
        </p>
        <p style={{ fontSize: 12, color: gps?.gps_valid ? '#22c55e' : '#4a5568' }}>
          {gps?.gps_valid ? 'Fix acquired' : (gps?.gps_valid === false ? 'No fix' : '—')}
        </p>
      </div>
      <div className="text-right">
        <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
          Satellites
        </p>
        <p className="mono" style={{ fontSize: 12, color: '#94a3b8' }}>
          {gps?.gps_sats ?? '—'}
        </p>
      </div>
      <div className="text-right">
        <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
          Dish inhibit
        </p>
        <p style={{ fontSize: 12, color: gps?.gps_enabled === true ? '#22c55e' : gps?.gps_enabled === false ? '#ef4444' : '#4a5568' }}>
          {gps?.gps_enabled === true ? 'Off (enabled)' : gps?.gps_enabled === false ? 'On (blocked)' : '—'}
        </p>
      </div>
    </div>
  )

  if (!enabled) {
    return (
      <div className="space-y-3">
        <HwStatus />

        {/* Reason banner */}
        {reasonInfo && (
          <div
            className="rounded-lg p-3 space-y-1"
            style={{ background: '#0a0c10', border: `1px solid ${reasonInfo.color}33` }}
          >
            <p style={{ fontSize: 11, color: reasonInfo.color, fontWeight: 500 }}>{reason?.replace(/_/g, ' ')}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{reasonInfo.text}</p>
            <p style={{ fontSize: 10, color: '#4a5568', lineHeight: 1.5 }}>{reasonInfo.hint}</p>
          </div>
        )}

        {/* Enable button + feedback */}
        <div
          className="rounded-lg p-3 space-y-2"
          style={{ background: '#0a0c10', border: '1px solid #1e2330' }}
        >
          <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            Enable via dashboard API
          </p>
          <button
            onClick={onEnable}
            disabled={busy}
            className="flex items-center gap-2 rounded px-3 py-1.5 font-medium transition-opacity disabled:opacity-50"
            style={{ fontSize: 12, background: '#0a2d6e', color: '#4d9fff', border: '1px solid #1a4a9e' }}
          >
            {busy ? 'Sending…' : 'Enable GPS'}
          </button>

          {result === 'ok' && (
            <div className="space-y-1">
              <p style={{ fontSize: 11, color: '#22c55e' }}>
                ✓ API call succeeded
                {apiResponse?.gps_enabled != null && ` — dish inhibit now ${apiResponse.gps_enabled ? 'off' : 'on'}`}
              </p>
              <p style={{ fontSize: 10, color: '#4a5568' }}>
                If coordinates still don't appear, confirm location sharing in the Starlink app too.
              </p>
            </div>
          )}
          {result === 'err' && (
            <p style={{ fontSize: 11, color: '#ef4444' }}>✗ {errMsg}</p>
          )}

          {/* App instructions */}
          <div className="pt-1" style={{ borderTop: '1px solid #1e2330' }}>
            <p style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Or via Starlink app
            </p>
            {[
              'Open the Starlink app on your phone',
              'Tap the menu (≡) → Settings',
              'Find "GPS" or "Share location data" and toggle on',
            ].map((s, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <span
                  className="shrink-0 rounded-full flex items-center justify-center font-medium"
                  style={{ width: 16, height: 16, fontSize: 9, background: '#1e2330', color: '#4a5568' }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 11, color: '#4a5568' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const { latitude: lat, longitude: lon, altitude: alt } = gps
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`

  return (
    <div className="space-y-2">
      <HwStatus />
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Latitude',  lat != null ? `${lat.toFixed(6)}°`  : '—'],
          ['Longitude', lon != null ? `${lon.toFixed(6)}°`  : '—'],
          ['Altitude',  alt != null ? `${alt.toFixed(1)} m` : '—'],
        ].map(([label, val]) => (
          <div key={label} className="rounded-lg p-2.5" style={{ background: '#0a0c10', border: '1px solid #1e2330' }}>
            <p style={{ fontSize: 9, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {label}
            </p>
            <p className="mono" style={{ fontSize: 13, color: '#e2e8f0' }}>{val}</p>
          </div>
        ))}
        {lat != null && lon != null && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-2.5 flex items-center justify-center transition-opacity hover:opacity-70"
            style={{ background: '#0a2d6e', border: '1px solid #1a4a9e', color: '#4d9fff', fontSize: 11 }}
          >
            Open in Maps ↗
          </a>
        )}
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={onDisable}
          disabled={busy}
          className="transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ fontSize: 10, color: '#4a5568' }}
        >
          Disable GPS reporting
        </button>
        {result === 'err' && <p style={{ fontSize: 10, color: '#ef4444' }}>{errMsg}</p>}
        {result === 'ok'  && <p style={{ fontSize: 10, color: '#22c55e' }}>Done</p>}
      </div>
    </div>
  )
}

// ── small helpers ─────────────────────────────────────────────────────────────

function StatRow({ label, children }) {
  return (
    <div
      className="flex justify-between items-center py-1.5"
      style={{ borderBottom: '0.5px solid #1a2030' }}
    >
      <span style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: '#cbd5e1' }}>{children}</span>
    </div>
  )
}

function StateBadge({ state }) {
  const colors = {
    CONNECTED:        { bg: '#0a3320', color: '#22c55e' },
    OBSTRUCTED:       { bg: '#3d2800', color: '#f59e0b' },
    THERMAL_SHUTDOWN: { bg: '#3b0c0c', color: '#ef4444' },
    SEARCHING:        { bg: '#0a1a3a', color: '#4d9fff' },
    BOOTING:          { bg: '#1e2330', color: '#4a5568' },
    STOWED:           { bg: '#1e2330', color: '#4a5568' },
  }
  const sty = colors[state] ?? { bg: '#1e2330', color: '#4a5568' }
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 font-medium"
      style={{ fontSize: 10, ...sty }}
    >
      {state ?? '—'}
    </span>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Diagnostics() {
  const { data, history } = useLive()
  const { data: diag }    = useApi('/api/diagnostics', 60_000)

  // GPS — poll every 15 s; re-fetch on enable/disable
  const [gpsTick,  setGpsTick]  = useState(0)
  const [gpsBusy,    setGpsBusy]    = useState(false)
  const [gpsResult,  setGpsRes]     = useState(null)   // null | 'ok' | 'err'
  const [gpsErr,     setGpsErr]     = useState('')
  const [gpsApiResp, setGpsApiResp] = useState(null)
  const { data: gpsData } = useApi(`/api/location?_t=${gpsTick}`, 15_000)

  const setGps = useCallback(async (enable) => {
    setGpsBusy(true)
    setGpsRes(null)
    setGpsApiResp(null)
    try {
      const r = await fetch(`/api/control/gps/${enable ? 'enable' : 'disable'}`, { method: 'POST' })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.detail ?? `HTTP ${r.status}`)
      setGpsRes('ok')
      setGpsApiResp(body)
      setGpsTick(t => t + 1)   // force re-fetch of location
    } catch (e) {
      setGpsRes('err')
      setGpsErr(e.message)
    } finally {
      setGpsBusy(false)
      setTimeout(() => { setGpsRes(null); setGpsApiResp(null) }, 8000)
    }
  }, [])

  // Build pointing history from live WS snapshots (last 90 readings = 90 s)
  const pointingHistory = useMemo(() =>
    history
      .slice(-90)
      .filter(h => h.direction_azimuth != null && h.direction_elevation != null)
      .map(h => ({ azimuth: h.direction_azimuth, elevation: h.direction_elevation })),
    [history]
  )

  const d = data ?? {}

  // Use diag endpoint for temps (it fetches fresh from status) or fall back to WS snapshot
  const dishTemp  = diag?.dish_temp_c  ?? d.dish_temp_c
  const boardTemp = diag?.board_temp_c ?? d.board_temp_c
  const azimuth   = diag?.pointing?.azimuth_deg   ?? d.direction_azimuth
  const elevation = diag?.pointing?.elevation_deg ?? d.direction_elevation

  return (
    <div className="flex gap-3 min-h-0">

      {/* ══ LEFT PANEL — large obstruction map ══════════════════════════════ */}
      <div
        className="rounded-lg p-4 flex flex-col gap-3 shrink-0"
        style={{ width: 300, background: '#0d1017', border: '1px solid #1e2330' }}
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
              <span style={{ color: diag.is_obstructed ? '#f59e0b' : '#22c55e' }}>
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
          style={{ background: '#0d1017', border: '1px solid #1e2330' }}
        >
          {/* Satellite / pointing tracker */}
          <div className="flex flex-col items-center gap-1">
            <p className="label mb-2">Satellite Tracker</p>
            <SatelliteTracker
              azimuth={azimuth}
              elevation={elevation}
              history={pointingHistory}
              size={150}
            />
          </div>

          {/* Temperature gauges */}
          <div className="flex flex-col gap-1">
            <p className="label mb-2">Temperatures</p>
            <div className="flex gap-4">
              <TempGauge label="Dish"  value={dishTemp}  size={120} unavailable={dishTemp  == null && boardTemp == null} />
              <TempGauge label="Board" value={boardTemp} size={120} unavailable={dishTemp  == null && boardTemp == null} />
            </div>
            {dishTemp == null && boardTemp == null && (
              <p style={{ fontSize: 10, color: '#2a3344', marginTop: 4 }}>
                Temperature data is not reported by this dish hardware
              </p>
            )}
          </div>
        </div>

        {/* Row 2: signal quality + connection status */}
        <div
          className="rounded-lg p-4"
          style={{ background: '#0d1017', border: '1px solid #1e2330' }}
        >
          <p className="label mb-3">Signal &amp; Status</p>

          {/* SNR indicator — segmented bar */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <span style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                SNR above noise floor
              </span>
              <span style={{
                fontSize: 10, fontWeight: 500,
                color: d.snr_above_floor === true  ? '#22c55e'
                     : d.snr_above_floor === false ? '#ef4444'
                     : '#2a3344',
              }}>
                {d.snr_above_floor === true  ? 'Yes'
                : d.snr_above_floor === false ? 'No'
                : '—'}
              </span>
            </div>
            {/* Visual bar */}
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 6, background: '#1e2330' }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: d.snr_above_floor ? '100%' : d.snr_above_floor === false ? '15%' : '0%',
                  background: d.snr_above_floor ? '#22c55e' : '#ef4444',
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
                <span style={{ color: d.gps_ready ? '#22c55e' : '#f59e0b' }}>
                  {d.gps_ready ? `Ready — ${d.gps_sats ?? '?'} sats` : 'Not ready'}
                </span>
              ) : '—'}
            </StatRow>
            <StatRow label="Latitude">
              {gpsData?.latitude != null
                ? <span className="mono" style={{ fontSize: 11 }}>{gpsData.latitude.toFixed(6)}°</span>
                : <span style={{ color: '#2a3344' }}>—</span>}
            </StatRow>
            <StatRow label="Longitude">
              {gpsData?.longitude != null
                ? <span className="mono" style={{ fontSize: 11 }}>{gpsData.longitude.toFixed(6)}°</span>
                : <span style={{ color: '#2a3344' }}>—</span>}
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
              <span className="mono" style={{ fontSize: 10, color: '#4a5568' }}>
                {d.software_version ?? '—'}
              </span>
            </StatRow>
            <StatRow label="Hardware">
              <span className="mono" style={{ fontSize: 10, color: '#4a5568' }}>
                {d.hardware_version ?? '—'}
              </span>
            </StatRow>
          </div>
        </div>
        {/* Row 3: GPS location */}
        <div
          className="rounded-lg p-4"
          style={{ background: '#0d1017', border: '1px solid #1e2330' }}
        >
          <p className="label mb-3">GPS Location</p>
          <GpsPanel
            gps={gpsData}
            onEnable={() => setGps(true)}
            onDisable={() => setGps(false)}
            busy={gpsBusy}
            result={gpsResult}
            errMsg={gpsErr}
            apiResponse={gpsApiResp}
          />
        </div>

      </div>
    </div>
  )
}
