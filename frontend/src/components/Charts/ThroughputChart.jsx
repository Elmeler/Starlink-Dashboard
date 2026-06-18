import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { useContext } from 'react'
import { LiveContext } from '../../App'

const DL_CLR  = '#4d9fff'
const UL_CLR  = '#22c55e'

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function ThroughputChart({ data = [] }) {
  const ctx = useContext(LiveContext)
  const isLight = ctx?.settings?.theme === 'light'

  const GRID     = isLight ? '#e2e8f0' : '#1e2330'
  const TICK     = { fontSize: 9, fill: isLight ? '#64748b' : '#4a5568' }
  const TIP_BG   = isLight ? '#ffffff' : '#0d1017'
  const TIP_BORD = isLight ? '#e2e8f0' : '#1e2330'
  const TIP_TEXT = isLight ? '#64748b' : '#4a5568'

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
      <div
        className="rounded px-2 py-1.5 text-xs"
        style={{ background: TIP_BG, border: `1px solid ${TIP_BORD}` }}
      >
        <p style={{ color: TIP_TEXT, marginBottom: 4 }}>{fmtTime(label)}</p>
        {payload.map(p => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {p.value != null ? p.value.toFixed(1) : '—'} Mbps
          </p>
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <span className="label">Throughput</span>
        <span className="flex items-center gap-1 text-xs" style={{ color: DL_CLR }}>
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: DL_CLR }} />
          Download
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: UL_CLR }}>
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: UL_CLR }} />
          Upload
        </span>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradDl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={DL_CLR} stopOpacity={0.25} />
              <stop offset="95%" stopColor={DL_CLR} stopOpacity={0}    />
            </linearGradient>
            <linearGradient id="gradUl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={UL_CLR} stopOpacity={0.25} />
              <stop offset="95%" stopColor={UL_CLR} stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={GRID} vertical={false} />

          <XAxis
            dataKey="timestamp"
            tickFormatter={fmtTime}
            tick={TICK}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tick={TICK}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}`}
            width={28}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="download_mbps"
            name="Download"
            stroke={DL_CLR}
            strokeWidth={1.5}
            fill="url(#gradDl)"
            dot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="upload_mbps"
            name="Upload"
            stroke={UL_CLR}
            strokeWidth={1.5}
            fill="url(#gradUl)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
