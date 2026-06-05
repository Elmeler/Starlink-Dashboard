import { useState, useEffect, useMemo } from 'react'
import { useLive }   from '../App'
import { useApi }    from '../hooks/useApi'

function cToF(c) { return c != null ? Math.round(c * 9 / 5 + 32) : null }
import StatCard        from '../components/Cards/StatCard'
import AlertBanner     from '../components/Cards/AlertBanner'
import ThroughputChart from '../components/Charts/ThroughputChart'
import LatencyChart    from '../components/Charts/LatencyChart'
import PowerChart      from '../components/Charts/PowerChart'
import ObstructionMap  from '../components/ObstructionMap'
import WanDetails      from '../components/WanDetails'

// ── threshold helpers ────────────────────────────────────────────────────────

function latencyColor(ms) {
  if (ms == null) return '#4a5568'
  if (ms < 50)   return '#22c55e'
  if (ms < 100)  return '#f59e0b'
  return '#ef4444'
}

function dropColor(pct) {
  if (pct == null) return '#4a5568'
  if (pct < 0.5)  return '#22c55e'
  if (pct < 2)    return '#f59e0b'
  return '#ef4444'
}

function tempColor(c) {
  if (c == null) return '#4a5568'
  if (c < 60)   return '#22c55e'
  if (c < 80)   return '#f59e0b'
  return '#ef4444'
}

function fmtUptime(s) {
  if (s == null) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function fmt1(v) { return v != null ? v.toFixed(1) : null }

// ── component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, history: wsHistory, settings } = useLive()
  const [dismissed, setDismissed]              = useState(new Set())
  const tempUnit = settings?.tempUnit ?? 'C'

  // Seed charts with backend history, then append live WS points
  const { data: seedResp }  = useApi('/api/history',          0)
  const { data: powerResp } = useApi('/api/history?hours=24', 60_000)
  const { data: diagData }  = useApi('/api/diagnostics',      60_000)
  const { data: wanData }   = useApi('/api/wan',              60_000)

  const chartData = useMemo(() => {
    const seed      = seedResp?.data ?? []
    const lastSeedTs = seed.at(-1)?.timestamp ?? 0
    const newLive    = wsHistory.filter(p => p.timestamp > lastSeedTs)
    return [...seed, ...newLive].slice(-900)
  }, [seedResp, wsHistory])

  // Remove dismissed keys that are no longer in the active alert list
  useEffect(() => {
    if (!data?.alerts?.length) return
    const activeKeys = new Set(data.alerts.map(a => a.key))
    setDismissed(prev => {
      const next = new Set([...prev].filter(k => activeKeys.has(k)))
      return next.size === prev.size ? prev : next
    })
  }, [data?.alerts])

  const d = data ?? {}

  return (
    <div className="space-y-2 max-w-full">

      {/* ── Alert banner ── */}
      <AlertBanner
        alerts={d.alerts ?? []}
        dismissed={dismissed}
        onDismiss={key => setDismissed(prev => new Set([...prev, key]))}
      />

      {/* ── 6 stat cards ── */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
        <StatCard
          label="Download"
          value={fmt1(d.download_mbps)}
          unit="Mbps"
          sublabel={d.download_mbps != null ? 'normal' : 'no data'}
          color="#22c55e"
        />
        <StatCard
          label="Upload"
          value={fmt1(d.upload_mbps)}
          unit="Mbps"
          sublabel={d.upload_mbps != null ? 'normal' : 'no data'}
          color="#22c55e"
        />
        <StatCard
          label="Latency"
          value={d.latency_ms != null ? Math.round(d.latency_ms) : null}
          unit="ms"
          sublabel={
            d.latency_ms == null ? 'no data' :
            d.latency_ms < 50   ? 'good'     :
            d.latency_ms < 100  ? 'elevated' : 'high'
          }
          color={latencyColor(d.latency_ms)}
        />
        <StatCard
          label="Drop rate"
          value={d.drop_rate_pct != null ? d.drop_rate_pct.toFixed(2) : null}
          unit="%"
          sublabel={
            d.drop_rate_pct == null ? 'no data' :
            d.drop_rate_pct < 0.5  ? 'good'     :
            d.drop_rate_pct < 2    ? 'elevated'  : 'high'
          }
          color={dropColor(d.drop_rate_pct)}
        />
        <StatCard
          label="Uptime"
          value={fmtUptime(d.uptime_s)}
          unit=""
          sublabel={d.state ?? ''}
          color="#4a5568"
        />
        <StatCard
          label="Dish temp"
          value={tempUnit === 'F' ? cToF(d.dish_temp_c) : (d.dish_temp_c != null ? Math.round(d.dish_temp_c) : null)}
          unit={`°${tempUnit}`}
          sublabel={
            d.dish_temp_c == null ? 'no data' :
            d.dish_temp_c < 60   ? 'normal'  :
            d.dish_temp_c < 80   ? 'warm'    : 'hot'
          }
          color={tempColor(d.dish_temp_c)}
        />
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="rounded-lg p-3"
          style={{ background: '#0d1017', border: '1px solid #1e2330' }}
        >
          <ThroughputChart data={chartData} />
        </div>
        <div
          className="rounded-lg p-3"
          style={{ background: '#0d1017', border: '1px solid #1e2330' }}
        >
          <LatencyChart data={chartData} />
        </div>
      </div>

      {/* ── Power chart (24 h from persistent DB) ── */}
      <div
        className="rounded-lg p-3"
        style={{ background: '#0d1017', border: '1px solid #1e2330' }}
      >
        <PowerChart data={powerResp?.data ?? []} hours={24} />
      </div>

      {/* ── Bottom row: obstruction map + WAN details ── */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'auto 1fr' }}>

        {/* Obstruction map */}
        <div
          className="rounded-lg p-3 flex flex-col"
          style={{ background: '#0d1017', border: '1px solid #1e2330' }}
        >
          <p className="label mb-2">Obstruction Map</p>
          <div className="flex-1 flex items-center justify-center">
            <ObstructionMap
              mapData={diagData?.obstruction_map}
              azimuth={diagData?.pointing?.azimuth_deg ?? d.direction_azimuth}
              elevation={diagData?.pointing?.elevation_deg ?? d.direction_elevation}
              size={190}
              showLegend
            />
          </div>
          {diagData?.fraction_obstructed_pct != null && (
            <p className="label mt-2 text-center">
              {diagData.fraction_obstructed_pct.toFixed(1)}% obstructed
            </p>
          )}
        </div>

        {/* WAN details */}
        <div
          className="rounded-lg p-3"
          style={{ background: '#0d1017', border: '1px solid #1e2330' }}
        >
          <WanDetails data={wanData} />
        </div>
      </div>

      {/* Firmware hint */}
      {d.software_version && (
        <p className="label text-right" style={{ color: '#2a3344' }}>
          fw {d.software_version}
          {d.hardware_version ? ` · hw ${d.hardware_version}` : ''}
        </p>
      )}
    </div>
  )
}
