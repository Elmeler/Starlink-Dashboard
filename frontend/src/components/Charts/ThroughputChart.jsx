import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

const DL_CLR  = '#4d9fff'
const UL_CLR  = '#22c55e'

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
          {p.name}: {p.value != null ? p.value.toFixed(2) : '—'} Mbps
        </p>
      ))}
    </div>
  )
}

export default function ThroughputChart({ data = [], height = 120 }) {
  const latest    = data.at(-1)
  const dlNow     = latest?.download_mbps ?? null
  const ulNow     = latest?.upload_mbps   ?? null
  const isIdle    = dlNow !== null && dlNow < 0.5 && ulNow !== null && ulNow < 0.5

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <span className="label">Throughput</span>
        <span className="flex items-center gap-1 text-xs" style={{ color: DL_CLR }}>
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: DL_CLR }} />
          {dlNow != null ? `↓ ${dlNow.toFixed(1)} Mbps` : 'Download'}
        </span>
        <span className="flex items-center gap-1 text-xs" style={{ color: UL_CLR }}>
          <span className="inline-block w-3 h-0.5 rounded" style={{ background: UL_CLR }} />
          {ulNow != null ? `↑ ${ulNow.toFixed(1)} Mbps` : 'Upload'}
        </span>
        {isIdle && (
          <span style={{ fontSize: 9, color: 'var(--text-5)', marginLeft: 'auto' }}>idle</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
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
            tick={{ fontSize: 9, fill: 'var(--text-4)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}`}
            width={36}
            domain={[0, dataMax => Math.max(Math.ceil(dataMax * 1.2), 1)]}
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
