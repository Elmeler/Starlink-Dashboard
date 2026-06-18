import { useState } from 'react'
import { IconPlugConnected, IconPlugConnectedX, IconRefresh, IconRadar, IconSun, IconMoon } from '@tabler/icons-react'
import { useLive } from '../App'

// ── sub-components ────────────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div
      className="rounded-lg p-4 space-y-4"
      style={{ background: 'var(--sl-surface)', border: '1px solid var(--sl-border)' }}
    >
      <p className="label">{title}</p>
      {children}
    </div>
  )
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span style={{ fontSize: 12, color: 'var(--sl-text-hi)' }}>{label}</span>
        {hint && <span style={{ fontSize: 10, color: 'var(--sl-text-dim)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

const POLL_OPTIONS = [1, 2, 5, 10]

function fmtUptime(s) {
  if (s == null) return '—'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function Settings() {
  const { settings, updateSetting, connected, dishConnected, data } = useLive()
  const wsUrl = `ws://${window.location.host}/ws/live`

  const [ipDraft,     setIpDraft]     = useState(settings.dishAddress)
  const [testStatus,  setTestStatus]  = useState(null)
  const [testMessage, setTestMessage] = useState('')

  async function testConnection() {
    setTestStatus('testing')
    setTestMessage('')
    try {
      const r   = await fetch('/api/health', { signal: AbortSignal.timeout(5000) })
      const data = await r.json()
      if (data.dish_reachable) {
        setTestStatus('ok')
        setTestMessage(`Dish reachable at ${data.dish_address}`)
      } else {
        setTestStatus('fail')
        setTestMessage(data.error ?? 'Dish not reachable')
      }
    } catch (err) {
      setTestStatus('fail')
      setTestMessage(err.message ?? 'Request failed')
    }
  }

  function saveIp() {
    if (ipDraft.trim()) updateSetting('dishAddress', ipDraft.trim())
  }

  const statusColor = testStatus === 'ok'
    ? 'var(--sl-success)'
    : testStatus === 'fail'
    ? 'var(--sl-danger)'
    : 'transparent'

  const statusBg = testStatus === 'ok'
    ? 'var(--sl-success-dim)'
    : testStatus === 'fail'
    ? 'var(--sl-danger-dim)'
    : 'transparent'

  return (
    <div className="space-y-3 max-w-lg">

      {/* ── Connection ── */}
      <Card title="Connection">
        <FieldRow
          label="Dish address"
          hint="host:port — changing requires app reload"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={ipDraft}
              onChange={e => setIpDraft(e.target.value)}
              onBlur={saveIp}
              onKeyDown={e => e.key === 'Enter' && saveIp()}
              className="flex-1 rounded px-3 py-1.5 mono outline-none"
              style={{
                fontSize: 12,
                background: 'var(--sl-surface-alt)',
                border: '1px solid var(--sl-border)',
                color: 'var(--sl-text-hi)',
              }}
              spellCheck={false}
            />
            <button
              onClick={testConnection}
              disabled={testStatus === 'testing'}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-opacity disabled:opacity-50"
              style={{ fontSize: 12, background: 'var(--sl-accent-bg)', color: 'var(--sl-accent)', border: '1px solid var(--sl-accent-border)', whiteSpace: 'nowrap' }}
            >
              {testStatus === 'testing'
                ? <IconRefresh size={13} stroke={2} className="animate-spin" />
                : <IconPlugConnected size={13} stroke={2} />}
              Test
            </button>
          </div>

          {testStatus && testStatus !== 'testing' && (
            <div
              className="flex items-center gap-2 rounded px-3 py-2 mt-1"
              style={{
                background: statusBg,
                border: `1px solid ${statusColor}`,
              }}
            >
              {testStatus === 'ok'
                ? <IconPlugConnected  size={13} stroke={2} style={{ color: 'var(--sl-success)', flexShrink: 0 }} />
                : <IconPlugConnectedX size={13} stroke={2} style={{ color: 'var(--sl-danger)',  flexShrink: 0 }} />}
              <span style={{ fontSize: 11, color: statusColor }}>{testMessage}</span>
            </div>
          )}
        </FieldRow>

        {/* Live WS status */}
        <div
          className="rounded-lg p-3 space-y-2"
          style={{ background: 'var(--sl-bg)', border: '1px solid var(--sl-border)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="inline-block rounded-full shrink-0"
                style={{
                  width: 7, height: 7,
                  background: connected ? 'var(--sl-success)' : 'var(--sl-text-lo)',
                  boxShadow: connected ? '0 0 5px var(--sl-success)' : 'none',
                }}
              />
              <span style={{ fontSize: 11, color: connected ? 'var(--sl-success)' : 'var(--sl-text-lo)', fontWeight: 500 }}>
                WebSocket {connected ? 'connected' : 'disconnected'}
              </span>
            </div>
            {connected && (
              <span style={{ fontSize: 9, color: 'var(--sl-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                live · 1 s
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline gap-2">
              <span style={{ fontSize: 10, color: 'var(--sl-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Endpoint</span>
              <code className="mono" style={{ fontSize: 10, color: 'var(--sl-text-lo)' }}>{wsUrl}</code>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span style={{ fontSize: 10, color: 'var(--sl-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dish gRPC</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 5, height: 5,
                    background: dishConnected ? 'var(--sl-success)' : 'var(--sl-danger)',
                    boxShadow: dishConnected ? '0 0 4px var(--sl-success)' : 'none',
                  }}
                />
                <code className="mono" style={{ fontSize: 10, color: dishConnected ? 'var(--sl-success)' : 'var(--sl-danger)' }}>
                  {settings.dishAddress}
                </code>
              </div>
            </div>
            {data?.software_version && (
              <div className="flex justify-between items-baseline gap-2">
                <span style={{ fontSize: 10, color: 'var(--sl-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Firmware</span>
                <code className="mono" style={{ fontSize: 10, color: 'var(--sl-text-lo)' }}>{data.software_version}</code>
              </div>
            )}
            {data?.uptime_s != null && (
              <div className="flex justify-between items-baseline gap-2">
                <span style={{ fontSize: 10, color: 'var(--sl-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dish uptime</span>
                <span style={{ fontSize: 10, color: 'var(--sl-text-lo)' }}>{fmtUptime(data.uptime_s)}</span>
              </div>
            )}
            {data?.state && (
              <div className="flex justify-between items-baseline gap-2">
                <span style={{ fontSize: 10, color: 'var(--sl-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dish state</span>
                <span style={{ fontSize: 10, color: data.state === 'CONNECTED' ? 'var(--sl-success)' : 'var(--sl-warning)' }}>{data.state}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Display ── */}
      <Card title="Display">
        <FieldRow label="Temperature unit">
          <div className="flex gap-1">
            {['C', 'F'].map(unit => (
              <button
                key={unit}
                onClick={() => updateSetting('tempUnit', unit)}
                className="rounded px-4 py-1.5 font-medium transition-colors"
                style={{
                  fontSize: 12,
                  background: settings.tempUnit === unit ? 'var(--sl-accent-bg)'     : 'var(--sl-surface-alt)',
                  color:      settings.tempUnit === unit ? 'var(--sl-accent)'         : 'var(--sl-text-lo)',
                  border:     `1px solid ${settings.tempUnit === unit ? 'var(--sl-accent-border)' : 'var(--sl-border)'}`,
                }}
              >
                °{unit}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Theme">
          <div className="flex gap-1">
            {[
              { value: 'dark',  label: 'Dark',  Icon: IconMoon },
              { value: 'light', label: 'Light', Icon: IconSun  },
            ].map(({ value, label, Icon }) => {
              const active = settings.theme === value
              return (
                <button
                  key={value}
                  onClick={() => updateSetting('theme', value)}
                  className="flex items-center gap-1.5 rounded px-4 py-1.5 font-medium transition-colors"
                  style={{
                    fontSize: 12,
                    background: active ? 'var(--sl-accent-bg)'     : 'var(--sl-surface-alt)',
                    color:      active ? 'var(--sl-accent)'         : 'var(--sl-text-lo)',
                    border:     `1px solid ${active ? 'var(--sl-accent-border)' : 'var(--sl-border)'}`,
                  }}
                >
                  <Icon size={13} stroke={2} />
                  {label}
                </button>
              )
            })}
          </div>
        </FieldRow>
      </Card>

      {/* ── Polling ── */}
      <Card title="Polling">
        <FieldRow
          label="Diagnostics &amp; device poll interval"
          hint="WebSocket telemetry is always 1 s"
        >
          <div className="flex gap-1 flex-wrap">
            {POLL_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => updateSetting('pollIntervalS', s)}
                className="rounded px-3 py-1.5 font-medium transition-colors"
                style={{
                  fontSize: 12,
                  background: settings.pollIntervalS === s ? 'var(--sl-accent-bg)'     : 'var(--sl-surface-alt)',
                  color:      settings.pollIntervalS === s ? 'var(--sl-accent)'         : 'var(--sl-text-lo)',
                  border:     `1px solid ${settings.pollIntervalS === s ? 'var(--sl-accent-border)' : 'var(--sl-border)'}`,
                }}
              >
                {s}s
              </button>
            ))}
          </div>
          <p style={{ fontSize: 10, color: 'var(--sl-text-dim)' }}>
            Applies on next page load — currently active: {settings.pollIntervalS}s
          </p>
        </FieldRow>
      </Card>

      {/* ── About ── */}
      <Card title="About">
        <div className="space-y-1.5">
          {[
            ['Application',  'Starlink Monitor'],
            ['Version',      '0.2.0'],
            ['Backend',      'FastAPI + Python 3.12'],
            ['Frontend',     'React 18 + Vite + Tailwind CSS'],
            ['Data source',  'Starlink dish gRPC API (192.168.100.1:9200)'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-baseline gap-4">
              <span style={{ fontSize: 10, color: 'var(--sl-text-lo)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </span>
              <span style={{ fontSize: 11, color: 'var(--sl-text-lo)' }}>{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
