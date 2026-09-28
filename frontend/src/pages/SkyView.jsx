import { useMemo } from 'react'
import { useLive }     from '../App'
import { useApi }      from '../hooks/useApi'
import ObstructionMap  from '../components/ObstructionMap'

export default function SkyView() {
  const { data, history } = useLive()
  const { data: diag }    = useApi('/api/diagnostics', 60_000)

  const d        = data ?? {}
  const azimuth  = diag?.pointing?.azimuth_deg   ?? d.direction_azimuth
  const elevation = diag?.pointing?.elevation_deg ?? d.direction_elevation

  const uptimeStr = useMemo(() => {
    const s = d.uptime_s
    if (!s) return null
    const days  = Math.floor(s / 86400)
    const hours = Math.floor((s % 86400) / 3600)
    const mins  = Math.floor((s % 3600) / 60)
    if (days > 0)  return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${mins}m`
    return `${mins}m`
  }, [d.uptime_s])

  const obstructedPct = diag?.fraction_obstructed_pct
  const isObstructed  = diag?.is_obstructed

  return (
    <div className="space-y-4">

      {/* ── Title row ── */}
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)' }}>Sky View</h2>
        <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
          Obstruction history accumulated since last reboot
          {uptimeStr ? ` · uptime ${uptimeStr}` : ''}
        </p>
      </div>

      {/* ── Main layout ── */}
      <div
        className="rounded-xl p-6 flex flex-col items-center gap-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <ObstructionMap
          mapData={diag?.obstruction_map}
          azimuth={azimuth}
          elevation={elevation}
          size={340}
          showLegend
        />

        {/* 4-column stats strip */}
        <div
          className="grid grid-cols-4 w-full"
          style={{ borderTop: '1px solid var(--border)', maxWidth: 500 }}
        >
          {[
            {
              label: 'Currently obstructed',
              value: isObstructed != null
                ? <span style={{ color: isObstructed ? 'var(--warn)' : 'var(--good)' }}>
                    {isObstructed ? 'Yes' : 'No'}
                  </span>
                : '—',
            },
            {
              label: 'Sky blocked',
              value: obstructedPct != null
                ? <span style={{
                    color: obstructedPct >= 2   ? 'var(--bad)'
                         : obstructedPct >= 0.5 ? 'var(--warn)'
                         : 'var(--good)'
                  }}>
                    {obstructedPct.toFixed(1)}%
                  </span>
                : '—',
            },
            {
              label: 'Azimuth',
              value: azimuth != null
                ? <span className="mono">{azimuth.toFixed(1)}°</span>
                : '—',
            },
            {
              label: 'Elevation',
              value: elevation != null
                ? <span className="mono">{elevation.toFixed(1)}°</span>
                : '—',
            },
          ].map(({ label, value }, i) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 py-3"
              style={i > 0 ? { borderLeft: '1px solid var(--border)' } : {}}
            >
              <span style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {label}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── How to read the map ── */}
      <div
        className="rounded-lg p-4 space-y-2"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          How to read this map
        </p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
          {[
            ['Centre', 'Directly overhead (zenith)'],
            ['Edge', 'Horizon (0° elevation)'],
            ['Blue', 'Clear sky — good signal'],
            ['Amber', 'Partial obstruction'],
            ['Red', 'Blocked — no signal'],
            ['Dark tint', 'Not yet scanned since last reboot'],
            ['Rings', '60° / 30° / 10° elevation lines'],
            ['Blue dot', 'Current satellite pointing direction'],
          ].map(([term, desc]) => (
            <div key={term} className="flex gap-2">
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', minWidth: 80 }}>{term}</span>
              <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
