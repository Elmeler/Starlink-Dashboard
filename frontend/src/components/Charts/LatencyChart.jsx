import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

const LAT_CLR  = '#a78bfa'
const DROP_CLR = '#f59e0b'

function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded px-2 py-1.5 text-xs"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <p style={{ color: 'var(--text-4)', marginBottom: 4 }}>{fmtTime(label)}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value != null ? p.value.toFixed(p.dataKey === 'drop_rate_pct' ? 2 : 0) : '—'}
          {p.dataKey === 'drop_rate_pct' ? ' %' : ' ms'}
        </p>
      ))}
    </div>
  )
}

export default function LatencyChart({ data = [], height = 120 }) {
  const latest  = data.at(-1)
  const latNow  = latest?.latency_ms    ?? null
  const dropNow = latest?.drop_rate_pct ?? null

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <span className="label">Latency &amp; Drop rate</span>
        <span className="flex items-center gap-1 text-xs" style={{ color: LAT_CLR }}>
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: LAT_CLR }} />
          {latNow != null ? `${Math.round(latNow)} ms` : 'Latency'}
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: DROP_CLR }}>
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: DROP_CLR }} />
          {dropNow != null ? `${dropNow.toFixed(2)} % drop` : 'Drop rate'}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 32, bottom: 0, left: 4 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />

          <XAxis
            dataKey="timestamp"
            tickFormatter={fmtTime}
            tick={{ fontSize: 9, fill: 'var(--text-4)' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />

          <YAxis
            yAxisId="lat"
            tick={{ fontSize: 9, fill: 'var(--text-4)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}`}
            width={36}
          />

          <YAxis
            yAxisId="drop"
            orientation="right"
            tick={{ fontSize: 9, fill: 'var(--text-4)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}%`}
            width={28}
          />

          <Tooltip content={<CustomTooltip />} />

          <Line
            yAxisId="lat"
            type="monotone"
            dataKey="latency_ms"
            name="Latency"
            stroke={LAT_CLR}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            yAxisId="drop"
            type="monotone"
            dataKey="drop_rate_pct"
            name="Drop rate"
            stroke={DROP_CLR}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
