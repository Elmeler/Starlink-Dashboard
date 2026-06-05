import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

const GRID    = '#1e2330'
const PWR_CLR = '#a78bfa'

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div
      className="rounded px-2 py-1.5 text-xs"
      style={{ background: '#0d1017', border: '1px solid #1e2330' }}
    >
      <p style={{ color: '#4a5568', marginBottom: 4 }}>{fmtTime(label)}</p>
      <p style={{ color: PWR_CLR }}>
        Power: {val != null ? val.toFixed(1) : '—'} W
      </p>
    </div>
  )
}

export default function PowerChart({ data = [], hours = 24 }) {
  const label = hours >= 24
    ? `${hours / 24}d`
    : `${hours}h`

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <span className="label">Power Consumption</span>
        <span className="flex items-center gap-1 text-xs" style={{ color: PWR_CLR }}>
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: PWR_CLR }} />
          Watts
        </span>
        <span style={{ fontSize: 10, color: '#2a3344', marginLeft: 'auto' }}>
          last {label}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradPwr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={PWR_CLR} stopOpacity={0.25} />
              <stop offset="95%" stopColor={PWR_CLR} stopOpacity={0}    />
            </linearGradient>
          </defs>

          <CartesianGrid stroke={GRID} vertical={false} />

          <XAxis
            dataKey="timestamp"
            tickFormatter={fmtTime}
            tick={{ fontSize: 9, fill: '#4a5568' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis
            tick={{ fontSize: 9, fill: '#4a5568' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}W`}
            width={32}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="power_w"
            name="Power"
            stroke={PWR_CLR}
            strokeWidth={1.5}
            fill="url(#gradPwr)"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
