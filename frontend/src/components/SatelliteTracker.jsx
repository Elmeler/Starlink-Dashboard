/**
 * Standalone satellite tracker — a clean polar plot showing only the
 * current pointing direction of the dish (or satellite position).
 *
 * Used on the Diagnostics page right panel.
 * The ObstructionMap component has its own inline dot for the Dashboard.
 */

import { useMemo, useId } from 'react'

const RINGS = [60, 30]
const CARDINALS = ['N', 'E', 'S', 'W']

function azXY(cx, cy, r, azDeg) {
  const rad = (azDeg - 90) * (Math.PI / 180)
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

export default function SatelliteTracker({
  azimuth   = null,
  elevation = null,
  size      = 160,
  history   = [],
}) {
  const cx   = size / 2
  const cy   = size / 2
  const maxR = size / 2 - 12

  const dotPos = useMemo(() => {
    if (azimuth == null || elevation == null) return null
    const r = Math.cos(elevation * Math.PI / 180) * maxR
    const [x, y] = azXY(cx, cy, r, azimuth)
    return { x, y }
  }, [azimuth, elevation, cx, cy, maxR])

  const trailPath = useMemo(() => {
    if (!history.length) return ''
    const pts = history.map(({ azimuth: az, elevation: el }) => {
      const r = Math.cos(el * Math.PI / 180) * maxR
      const [x, y] = azXY(cx, cy, r, az)
      return `${x},${y}`
    })
    return `M ${pts.join(' L ')}`
  }, [history, cx, cy, maxR])

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
        {/* Background */}
        <circle cx={cx} cy={cy} r={maxR} fill="var(--sl-bg)" stroke="var(--sl-border)" strokeWidth={1} />

        {/* Elevation rings */}
        {RINGS.map(elev => (
          <circle
            key={elev}
            cx={cx} cy={cy}
            r={Math.cos(elev * Math.PI / 180) * maxR}
            fill="none"
            stroke="var(--sl-border)"
            strokeWidth={0.6}
            strokeDasharray="2 3"
          />
        ))}

        {/* Cross-hairs */}
        <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="var(--sl-border)" strokeWidth={0.5} />
        <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="var(--sl-border)" strokeWidth={0.5} />

        {/* Cardinal labels */}
        {CARDINALS.map((lbl, i) => {
          const [x, y] = azXY(cx, cy, maxR + 9, i * 90)
          return (
            <text
              key={lbl} x={x} y={y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={8} fill="var(--sl-text-lo)"
              fontFamily="Space Grotesk, sans-serif"
            >
              {lbl}
            </text>
          )
        })}

        {/* Trail */}
        {trailPath && (
          <path d={trailPath} fill="none" stroke="#4d9fff" strokeWidth={1} strokeOpacity={0.35} />
        )}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={2} fill="var(--sl-text-hi)" />

        {/* Satellite dot */}
        {dotPos ? (
          <g>
            <circle cx={dotPos.x} cy={dotPos.y} r={4} fill="none" stroke="#4d9fff" strokeWidth={1}>
              <animate attributeName="r"       values="4;10;4"    dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx={dotPos.x} cy={dotPos.y} r={3} fill="#4d9fff" />
          </g>
        ) : (
          <text
            x={cx} y={cy}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="var(--sl-text-dim)"
            fontFamily="Space Grotesk, sans-serif"
          >
            no data
          </text>
        )}
      </svg>

      <p style={{ fontSize: 9, color: 'var(--sl-text-lo)' }}>
        {azimuth != null
          ? `Az ${azimuth.toFixed(1)}°  El ${elevation?.toFixed(1)}°`
          : 'no pointing data'}
      </p>
    </div>
  )
}
