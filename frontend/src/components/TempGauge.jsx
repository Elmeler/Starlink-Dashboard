
const ZONES = [
  { from: 0,    to: 0.60, dim: '#0d3320', bright: '#22c55e' },
  { from: 0.60, to: 0.80, dim: '#3d2800', bright: '#f59e0b' },
  { from: 0.80, to: 1.00, dim: '#3b0c0c', bright: '#ef4444' },
]

function valueColor(frac) {
  if (frac >= 0.80) return '#ef4444'
  if (frac >= 0.60) return '#f59e0b'
  return '#22c55e'
}

/**
 * Point on the semicircle at fraction f (0=left, 0.5=top, 1=right).
 * cx, cy is the centre of the full circle; r is the radius.
 */
function pt(cx, cy, r, f) {
  const a = Math.PI * (1 - f)           // π at f=0, 0 at f=1
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)]  // SVG y is inverted
}

/**
 * SVG arc path from fraction f1 to f2 along the top semicircle.
 * Always counter-clockwise (sweep=0).
 */
function arcPath(cx, cy, r, f1, f2) {
  if (Math.abs(f2 - f1) < 0.001) return ''
  const [x1, y1] = pt(cx, cy, r, f1)
  const [x2, y2] = pt(cx, cy, r, f2)
  // Arc spans (f2-f1)*180°; large-arc flag needed only if >180° (never here)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}


export default function TempGauge({
  label    = 'Temp',
  value    = null,     // always °C from backend
  maxTemp  = 100,
  size     = 130,
  unavailable = false, // set true when hardware doesn't report this sensor
}) {
  const display = value != null ? Math.round(value) : null
  const unit    = '°C'

  // Short-circuit: render a greyed-out placeholder when hardware doesn't report
  if (unavailable) {
    return (
      <div className="flex flex-col items-center gap-1">
        <svg viewBox={`0 0 120 76`} width={size} style={{ display: 'block', overflow: 'visible' }}>
          {[
            { from: 0, to: 0.60 },
            { from: 0.60, to: 0.80 },
            { from: 0.80, to: 1.00 },
          ].map(z => (
            <path
              key={z.from}
              d={arcPath(60, 68, 52, z.from, z.to)}
              fill="none" stroke="#1a2030" strokeWidth={9} strokeLinecap="round"
            />
          ))}
          <text x={60} y={54} textAnchor="middle" dominantBaseline="middle"
            fontSize={10} fill="#2a3344" fontFamily="Space Grotesk, sans-serif">
            N/A
          </text>
          <text x={60} y={67} textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fill="#1e2a3a" fontFamily="Space Grotesk, sans-serif">
            not reported
          </text>
        </svg>
        <span style={{ fontSize: 10, color: '#2a3344', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
    )
  }

  // Keep colour zones always in °C scale regardless of display unit

  // SVG viewport: 0 0 120 76
  // Arc centre at (60, 68), radius 52
  const VW = 120, VH = 76
  const CX = 60,  CY = 68, R = 52
  const SW = 9                             // stroke width
  const frac = value != null ? Math.min(Math.max(value / maxTemp, 0), 1) : 0

  // Zone boundary labels
  const zone60 = maxTemp * 0.6
  const zone80 = maxTemp * 0.8

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        width={size}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {/* ── Dimmed background zone arcs ── */}
        {ZONES.map(z => (
          <path
            key={z.from}
            d={arcPath(CX, CY, R, z.from, z.to)}
            fill="none"
            stroke={z.dim}
            strokeWidth={SW}
            strokeLinecap="round"
          />
        ))}

        {/* ── Active fill arc (current value) ── */}
        {value != null && frac > 0.001 && (
          <path
            d={arcPath(CX, CY, R, 0, frac)}
            fill="none"
            stroke={valueColor(frac)}
            strokeWidth={SW}
            strokeLinecap="round"
          />
        )}

        {/* ── Tick marks at zone boundaries ── */}
        {[0, 0.6, 0.8, 1].map(f => {
          const inner = R - SW / 2 - 1
          const outer = R + SW / 2 + 2
          const [xi, yi] = pt(CX, CY, inner, f)
          const [xo, yo] = pt(CX, CY, outer, f)
          return (
            <line
              key={f}
              x1={xi.toFixed(1)} y1={yi.toFixed(1)}
              x2={xo.toFixed(1)} y2={yo.toFixed(1)}
              stroke="#1e2330"
              strokeWidth={1}
            />
          )
        })}

        {/* ── Zone labels at arc ends ── */}
        {[
          { f: 0,   txt: '0'          },
          { f: 0.6, txt: `${zone60}`  },
          { f: 0.8, txt: `${zone80}`  },
          { f: 1,   txt: `${maxTemp}` },
        ].map(({ f, txt }) => {
          const labelR = R + SW / 2 + 10
          const [lx, ly] = pt(CX, CY, labelR, f)
          return (
            <text
              key={f}
              x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fill="#2a3344"
              fontFamily="Space Grotesk, sans-serif"
            >
              {txt}
            </text>
          )
        })}

        {/* ── Centre value ── */}
        <text
          x={CX} y={CY - 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={22}
          fontWeight={500}
          fill={value != null ? valueColor(frac) : '#2a3344'}
          fontFamily="Space Grotesk, sans-serif"
        >
          {display ?? '—'}
        </text>
        <text
          x={CX} y={CY - 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="#4a5568"
          fontFamily="Space Grotesk, sans-serif"
        >
          {unit}
        </text>
      </svg>

      <span style={{ fontSize: 10, color: '#4a5568', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  )
}
