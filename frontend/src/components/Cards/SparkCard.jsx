/**
 * Stat card with an embedded SVG sparkline.
 * Drop-in replacement for StatCard when you also have a data series.
 *
 * Props:
 *   label      string    — e.g. "LATENCY"
 *   value      any       — displayed large; null/undefined → "—"
 *   unit       string    — e.g. "ms"
 *   sublabel   string    — small colored status line below the sparkline
 *   color      string    — CSS color for sublabel + sparkline stroke
 *   sparkData  number[]  — array of values (nulls are gaps); last ~60 entries used
 */

function Sparkline({ data, color, height = 30 }) {
  const vals = data.filter(v => v != null)
  if (vals.length < 2) return null

  const min   = Math.min(...vals)
  const max   = Math.max(...vals)
  const range = max - min || 1
  const n     = data.length

  // Build SVG polyline points string, skipping null gaps
  let d = ''
  data.forEach((v, i) => {
    if (v == null) return
    const x = ((i / (n - 1)) * 96 + 2).toFixed(1)   // 2–98 keeps tips visible
    const y = (height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)
    d += d ? ` ${x},${y}` : `${x},${y}`
  })

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      style={{ overflow: 'visible', display: 'block' }}
    >
      <polyline
        points={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.8}
      />
    </svg>
  )
}

export default function SparkCard({ label, value, unit, sublabel, color = '#22c55e', sparkData }) {
  const display = value === null || value === undefined ? '—' : value

  return (
    <div
      className="rounded-lg flex flex-col gap-1"
      style={{
        background: '#0d1017',
        border: '1px solid #1e2330',
        padding: '10px 12px',
        minWidth: 0,
      }}
    >
      <span
        className="uppercase tracking-widest"
        style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.08em' }}
      >
        {label}
      </span>

      <div className="flex items-baseline gap-1.5">
        <span
          className="font-medium tabular-nums"
          style={{ fontSize: 20, color: '#e2e8f0', lineHeight: 1 }}
        >
          {display}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: '#4a5568' }}>{unit}</span>
        )}
      </div>

      {sparkData?.length > 1 && (
        <Sparkline data={sparkData} color={color} height={30} />
      )}

      {sublabel && (
        <span style={{ fontSize: 10, color }}>{sublabel}</span>
      )}
    </div>
  )
}
