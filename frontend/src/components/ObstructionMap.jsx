/**
 * SVG polar obstruction map.
 *
 * The Starlink API returns a rectangular num_rows × num_cols SNR grid where:
 *   - Centre of the grid = zenith (directly overhead)
 *   - Top edge = North, right edge = East  (standard image orientation)
 *   - Distance from centre = cos(elevation), so horizon is at the edge
 *   - Each cell value: 0.0 (blocked) → 1.0 (clear), -1.0 (no data / not yet scanned)
 *
 * No-data cells (-1) are rendered as a faint tint so the user can see the
 * actual scan coverage area vs. unvisited sky.  Only the data cells are
 * blurred so the signal shapes blend smoothly without smearing into unscanned
 * areas.
 */

import { useMemo, useId } from 'react'

// --- color mapping -----------------------------------------------------------

// Returns { fill, opacity, isData } for every cell
function snrCell(v) {
  if (v < 0)    return { fill: '#0e1c2e', opacity: 0.55, isData: false }  // not yet scanned
  if (v >= 0.7) return { fill: '#3b82f6', opacity: 0.92, isData: true  }  // clear
  if (v >= 0.3) return { fill: '#f59e0b', opacity: 0.90, isData: true  }  // partial
  return                { fill: '#ef4444', opacity: 0.90, isData: true  }  // blocked
}

// --- helpers -----------------------------------------------------------------

function azXY(cx, cy, r, azDeg) {
  const rad = (azDeg - 90) * (Math.PI / 180)
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
}

// Elevation rings — 10° catches horizon blockage; 30°/60° give context
const ELEV_RINGS = [
  { elev: 60, label: '60°', dash: '1.5 3' },
  { elev: 30, label: '30°', dash: '2 3'   },
  { elev: 10, label: '10°', dash: '1 2'   },
]

const CARDINALS     = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const TICK_AZIMUTHS = [0, 45, 90, 135, 180, 225, 270, 315]

// -----------------------------------------------------------------------------

export default function ObstructionMap({
  mapData    = null,
  azimuth    = null,
  elevation  = null,
  size       = 200,
  showLegend = true,
}) {
  const uid  = useId().replace(/:/g, '')
  const cx   = size / 2
  const cy   = size / 2
  const maxR = size / 2 - 18

  const clipId      = `hemi-clip-${uid}`
  const bgGradId    = `bg-grad-${uid}`
  const dataBlurId  = `data-blur-${uid}`
  const glowId      = `sat-glow-${uid}`
  const outerGlowId = `outer-glow-${uid}`

  // Blur only the data cells — softens pixel edges without smearing into unscanned areas
  const dataBlurRadius = Math.max(0.4, size / 420)

  // Split cells into no-data (faint tint) and signal (blurred data layer)
  const { noCells, dataCells } = useMemo(() => {
    const noCells   = []
    const dataCells = []
    if (!mapData?.snr?.length) return { noCells, dataCells }
    const { num_rows: rows, num_cols: cols, snr } = mapData
    if (!rows || !cols) return { noCells, dataCells }

    const cellW = (2 * maxR) / cols
    const cellH = (2 * maxR) / rows

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v    = snr[r * cols + c]
        const cell = snrCell(v)
        const x    = cx - maxR + (c + 0.5) * cellW
        const y    = cy - maxR + (r + 0.5) * cellH
        const item = { x, y, w: cellW, h: cellH, fill: cell.fill, opacity: cell.opacity }
        if (cell.isData) dataCells.push(item)
        else             noCells.push(item)
      }
    }
    return { noCells, dataCells }
  }, [mapData, cx, cy, maxR])

  const satPos = useMemo(() => {
    if (azimuth == null || elevation == null) return null
    const r = Math.cos(elevation * Math.PI / 180) * maxR
    const [x, y] = azXY(cx, cy, r, azimuth)
    return { x, y }
  }, [azimuth, elevation, cx, cy, maxR])

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <svg
        width={size}
        height={size}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={maxR} />
          </clipPath>

          <radialGradient id={bgGradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#111827" stopOpacity="1" />
            <stop offset="100%" stopColor="#060a0f" stopOpacity="1" />
          </radialGradient>

          {/* Blur applied only to signal data cells */}
          <filter id={dataBlurId} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={dataBlurRadius} />
          </filter>

          <filter id={glowId} x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#60a5fa" floodOpacity="0.9" />
          </filter>

          <filter id={outerGlowId} x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#1e3a5f" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* ── Background ── */}
        <circle cx={cx} cy={cy} r={maxR} fill={`url(#${bgGradId})`} />

        {/* ── Outer decorative ring ── */}
        <circle
          cx={cx} cy={cy} r={maxR}
          fill="none" stroke="#1e3a5f" strokeWidth={1.5}
          filter={`url(#${outerGlowId})`}
        />

        {/* ── No-data cells — crisp, no blur — show scan coverage boundary ── */}
        <g clipPath={`url(#${clipId})`}>
          {noCells.map((c, i) => (
            <rect
              key={i}
              x={c.x - c.w / 2} y={c.y - c.h / 2}
              width={c.w} height={c.h}
              fill={c.fill} fillOpacity={c.opacity}
            />
          ))}
        </g>

        {/* ── Signal data cells — blurred so colors blend smoothly ── */}
        <g clipPath={`url(#${clipId})`} filter={`url(#${dataBlurId})`}>
          {dataCells.map((c, i) => (
            <rect
              key={i}
              x={c.x - c.w / 2} y={c.y - c.h / 2}
              width={c.w} height={c.h}
              fill={c.fill} fillOpacity={c.opacity}
            />
          ))}
        </g>

        {/* ── Elevation rings ── */}
        {ELEV_RINGS.map(({ elev, dash }) => {
          const r = Math.cos(elev * Math.PI / 180) * maxR
          return (
            <circle
              key={elev}
              cx={cx} cy={cy} r={r}
              fill="none" stroke="#1e3557" strokeWidth={0.8} strokeDasharray={dash}
            />
          )
        })}

        {/* ── Elevation ring labels — east side ── */}
        {ELEV_RINGS.map(({ elev, label }) => {
          const r = Math.cos(elev * Math.PI / 180) * maxR
          return (
            <text
              key={`lbl-${elev}`}
              x={cx + r + 3} y={cy + 1}
              textAnchor="start" dominantBaseline="middle"
              fontSize={Math.max(7, size / 34)}
              fill="#2a4a6e"
              fontFamily="Space Grotesk, monospace"
            >
              {label}
            </text>
          )
        })}

        {/* ── Cross-hairs ── */}
        <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#1e3557" strokeWidth={0.6} />
        <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#1e3557" strokeWidth={0.6} />

        {/* ── Compass tick marks ── */}
        {TICK_AZIMUTHS.map(az => {
          const isCardinal = az % 90 === 0
          const tickLen    = isCardinal ? 6 : 3.5
          const [ox, oy]   = azXY(cx, cy, maxR,           az)
          const [ix, iy]   = azXY(cx, cy, maxR - tickLen, az)
          return (
            <line
              key={az}
              x1={ox} y1={oy} x2={ix} y2={iy}
              stroke={isCardinal ? '#2a5a9e' : '#1e3557'}
              strokeWidth={isCardinal ? 1.2 : 0.7}
            />
          )
        })}

        {/* ── Cardinal labels ── */}
        {CARDINALS.map((lbl, i) => {
          const az         = TICK_AZIMUTHS[i]
          const isCardinal = az % 90 === 0
          const [x, y]     = azXY(cx, cy, maxR + 11, az)
          return (
            <text
              key={lbl}
              x={x} y={y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={isCardinal ? Math.max(9, size / 24) : Math.max(7, size / 34)}
              fontWeight={isCardinal ? 600 : 400}
              fill={lbl === 'N' ? '#60a5fa' : isCardinal ? '#3b6ea8' : '#1e3557'}
              fontFamily="Space Grotesk, sans-serif"
            >
              {lbl}
            </text>
          )
        })}

        {/* ── Centre dot ── */}
        <circle cx={cx} cy={cy} r={2.5} fill="#94a3b8" />
        <circle cx={cx} cy={cy} r={1.5} fill="#e2e8f0" />

        {/* ── Satellite / current pointing position ── */}
        {satPos && (
          <g>
            <circle cx={satPos.x} cy={satPos.y} r={5} fill="none" stroke="#60a5fa" strokeWidth={1}>
              <animate attributeName="r"       values="5;13;5"    dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx={satPos.x} cy={satPos.y} r={4} fill="#60a5fa" filter={`url(#${glowId})`} />
            <circle cx={satPos.x} cy={satPos.y} r={2} fill="#e2e8f0" />
          </g>
        )}

        {/* ── No-data placeholder ── */}
        {!mapData && (
          <text
            x={cx} y={cy}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={Math.max(10, size / 20)}
            fill="#1e3557"
            fontFamily="Space Grotesk, sans-serif"
          >
            awaiting data
          </text>
        )}
      </svg>

      {/* ── Legend ── */}
      {showLegend && (
        <div className="flex gap-4">
          {[
            { color: '#3b82f6', label: 'Clear'        },
            { color: '#f59e0b', label: 'Partial'       },
            { color: '#ef4444', label: 'Blocked'       },
            { color: '#0e1c2e', label: 'Not yet scanned', border: '#1e3557' },
          ].map(({ color, label, border }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="inline-block rounded-sm"
                style={{
                  width: 8, height: 8, background: color, opacity: 0.85,
                  border: border ? `1px solid ${border}` : undefined,
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
