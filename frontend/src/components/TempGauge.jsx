/**
 * Semicircle arc temperature gauge.
 * Reads tempUnit ('C' | 'F') from LiveContext when available.
 */
import { useContext } from 'react'
import { LiveContext } from '../App'

const ZONES = [
  { from: 0,    to: 0.60, dim: 'var(--sl-success-dim)', bright: '#22c55e' },
  { from: 0.60, to: 0.80, dim: 'var(--sl-warning-dim)', bright: '#f59e0b' },
  { from: 0.80, to: 1.00, dim: 'var(--sl-danger-dim)',  bright: '#ef4444' },
]

function valueColor(frac) {
  if (frac >= 0.80) return '#ef4444'
  if (frac >= 0.60) return '#f59e0b'
  return '#22c55e'
}

function pt(cx, cy, r, f) {
  const a = Math.PI * (1 - f)
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)]
}

function arcPath(cx, cy, r, f1, f2) {
  if (Math.abs(f2 - f1) < 0.001) return ''
  const [x1, y1] = pt(cx, cy, r, f1)
  const [x2, y2] = pt(cx, cy, r, f2)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

function cToF(c) { return c != null ? Math.round(c * 9 / 5 + 32) : null }

export default function TempGauge({
  label    = 'Temp',
  value    = null,
  maxTemp  = 100,
  size     = 130,
}) {
  const ctx      = useContext(LiveContext)
  const tempUnit = ctx?.settings?.tempUnit ?? 'C'
  const display  = tempUnit === 'F' ? cToF(value) : (value != null ? Math.round(value) : null)
  const unit     = `°${tempUnit}`

  const VW = 120, VH = 76
  const CX = 60,  CY = 68, R = 52
  const SW = 9
  const frac = value != null ? Math.min(Math.max(value / maxTemp, 0), 1) : 0

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
              stroke="var(--sl-border)"
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
              fill="var(--sl-text-dim)"
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
          fill={value != null ? valueColor(frac) : 'var(--sl-text-dim)'}
          fontFamily="Space Grotesk, sans-serif"
        >
          {display ?? '—'}
        </text>
        <text
          x={CX} y={CY - 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill="var(--sl-text-lo)"
          fontFamily="Space Grotesk, sans-serif"
        >
          {unit}
        </text>
      </svg>

      <span style={{ fontSize: 10, color: 'var(--sl-text-lo)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  )
}
