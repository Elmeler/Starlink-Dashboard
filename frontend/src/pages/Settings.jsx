import { useState, useCallback } from 'react'
import { IconPlugConnected, IconPlugConnectedX, IconRefresh, IconRadar, IconPower, IconAnchor } from '@tabler/icons-react'
import { useLive } from '../App'

// ── sub-components ────────────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div
      className="rounded-lg p-4 space-y-4"
      style={{ background: '#0d1017', border: '1px solid #1e2330' }}
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
        <span style={{ fontSize: 12, color: '#e2e8f0' }}>{label}</span>
        {hint && <span style={{ fontSize: 10, color: '#2a3344' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// ── component ─────────────────────────────────────────────────────────────────

const POLL_OPTIONS = [1, 2, 5, 10]

/**
 * Two-step confirm button. First click → arms (shows warning text).
 * Second click within 4 s → fires action. Auto-resets if not confirmed.
 */
function ConfirmButton({ label, description, icon: Icon, accentBg, accentColor, accentBorder, onConfirm }) {
  const [armed, setArmed]     = useState(false)
  const [busy,  setBusy]      = useState(false)
  const [result, setResult]   = useState(null)   // null | 'ok' | 'err'
  const [errMsg, setErrMsg]   = useState('')

  const arm = useCallback(() => {
    setArmed(true)
    setResult(null)
    setTimeout(() => setArmed(false), 4000)
  }, [])

  const fire = useCallback(async () => {
    setArmed(false)
    setBusy(true)
    setResult(null)
    try {
      const r = await fetch(onConfirm, { method: 'POST' })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${r.status}`)
      }
      setResult('ok')
    } catch (e) {
      setResult('err')
      setErrMsg(e.message)
    } finally {
      setBusy(false)
      setTimeout(() => setResult(null), 4000)
    }
  }, [onConfirm])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={armed ? fire : arm}
          disabled={busy}
          className="flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-all disabled:opacity-50"
          style={{
            fontSize: 12,
            background: armed ? accentBg    : '#111520',
            color:      armed ? accentColor : '#4a5568',
            border:     `1px solid ${armed ? accentBorder : '#1e2330'}`,
            whiteSpace: 'nowrap',
            minWidth: 90,
          }}
        >
          {busy
            ? <IconRefresh size={13} stroke={2} className="animate-spin" />
            : <Icon size={13} stroke={2} />}
          {armed ? 'Confirm?' : label}
        </button>
        <span style={{ fontSize: 10, color: '#2a3344' }}>{description}</span>
      </div>
      {result === 'ok'  && <p style={{ fontSize: 10, color: '#22c55e' }}>Done</p>}
      {result === 'err' && <p style={{ fontSize: 10, color: '#ef4444' }}>{errMsg}</p>}
    </div>
  )
}

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

  // Local state for the IP field (controlled while editing)
  const [ipDraft,     setIpDraft]     = useState(settings.dishAddress)
  const [testStatus,  setTestStatus]  = useState(null)   // null | 'testing' | 'ok' | 'fail'
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

  const statusColor = {
    ok:      '#22c55e',
    fail:    '#ef4444',
    testing: '#f59e0b',
  }[testStatus] ?? 'transparent'

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
                background: '#111520',
                border: '1px solid #1e2330',
                color: '#e2e8f0',
              }}
              spellCheck={false}
            />
            <button
              onClick={testConnection}
              disabled={testStatus === 'testing'}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-opacity disabled:opacity-50"
              style={{ fontSize: 12, background: '#0a2d6e', color: '#4d9fff', border: '1px solid #1a4a9e', whiteSpace: 'nowrap' }}
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
                background: testStatus === 'ok' ? '#0a3320' : '#3b0c0c',
                border: `1px solid ${statusColor}`,
              }}
            >
              {testStatus === 'ok'
                ? <IconPlugConnected  size={13} stroke={2} style={{ color: '#22c55e', flexShrink: 0 }} />
                : <IconPlugConnectedX size={13} stroke={2} style={{ color: '#ef4444', flexShrink: 0 }} />}
              <span style={{ fontSize: 11, color: statusColor }}>{testMessage}</span>
            </div>
          )}
        </FieldRow>

        {/* Live WS status */}
        <div
          className="rounded-lg p-3 space-y-2"
          style={{ background: '#0a0c10', border: '1px solid #1e2330' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="inline-block rounded-full shrink-0"
                style={{
                  width: 7, height: 7,
                  background: connected ? '#22c55e' : '#4a5568',
                  boxShadow: connected ? '0 0 5px #22c55e' : 'none',
                }}
              />
              <span style={{ fontSize: 11, color: connected ? '#22c55e' : '#4a5568', fontWeight: 500 }}>
                WebSocket {connected ? 'connected' : 'disconnected'}
              </span>
            </div>
            {connected && (
              <span style={{ fontSize: 9, color: '#2a3344', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                live · 1 s
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline gap-2">
              <span style={{ fontSize: 10, color: '#2a3344', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Endpoint</span>
              <code className="mono" style={{ fontSize: 10, color: '#4a5568' }}>{wsUrl}</code>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span style={{ fontSize: 10, color: '#2a3344', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dish gRPC</span>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 5, height: 5,
                    background: dishConnected ? '#22c55e' : '#ef4444',
                    boxShadow: dishConnected ? '0 0 4px #22c55e' : 'none',
                  }}
                />
                <code className="mono" style={{ fontSize: 10, color: dishConnected ? '#22c55e' : '#ef4444' }}>
                  {settings.dishAddress}
                </code>
              </div>
            </div>
            {data?.software_version && (
              <div className="flex justify-between items-baseline gap-2">
                <span style={{ fontSize: 10, color: '#2a3344', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Firmware</span>
                <code className="mono" style={{ fontSize: 10, color: '#4a5568' }}>{data.software_version}</code>
              </div>
            )}
            {data?.uptime_s != null && (
              <div className="flex justify-between items-baseline gap-2">
                <span style={{ fontSize: 10, color: '#2a3344', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dish uptime</span>
                <span style={{ fontSize: 10, color: '#4a5568' }}>{fmtUptime(data.uptime_s)}</span>
              </div>
            )}
            {data?.state && (
              <div className="flex justify-between items-baseline gap-2">
                <span style={{ fontSize: 10, color: '#2a3344', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Dish state</span>
                <span style={{ fontSize: 10, color: data.state === 'CONNECTED' ? '#22c55e' : '#f59e0b' }}>{data.state}</span>
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
                  background: settings.tempUnit === unit ? '#0a2d6e' : '#111520',
                  color:      settings.tempUnit === unit ? '#4d9fff' : '#4a5568',
                  border:     `1px solid ${settings.tempUnit === unit ? '#1a4a9e' : '#1e2330'}`,
                }}
              >
                °{unit}
              </button>
            ))}
          </div>
        </FieldRow>

        <FieldRow label="Theme" hint="Additional themes coming later">
          <div
            className="flex items-center gap-2 rounded px-3 py-2"
            style={{ background: '#111520', border: '1px solid #1e2330', width: 'fit-content' }}
          >
            <span
              className="inline-block rounded-full"
              style={{ width: 8, height: 8, background: '#4d9fff' }}
            />
            <span style={{ fontSize: 12, color: '#4a5568' }}>Dark (Starlink)</span>
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
                  background: settings.pollIntervalS === s ? '#0a2d6e' : '#111520',
                  color:      settings.pollIntervalS === s ? '#4d9fff' : '#4a5568',
                  border:     `1px solid ${settings.pollIntervalS === s ? '#1a4a9e' : '#1e2330'}`,
                }}
              >
                {s}s
              </button>
            ))}
          </div>
          <p style={{ fontSize: 10, color: '#2a3344' }}>
            Applies on next page load — currently active: {settings.pollIntervalS}s
          </p>
        </FieldRow>
      </Card>

      {/* ── Dish Controls ── */}
      <Card title="Dish Controls">
        <p style={{ fontSize: 11, color: '#4a5568' }}>
          Actions take effect immediately. Click once to arm, again to confirm.
        </p>
        <ConfirmButton
          label="Reboot"
          description="Restart the dish — connection drops for ~60 s"
          icon={IconPower}
          accentBg="#3b0c0c" accentColor="#ef4444" accentBorder="#7c2d12"
          onConfirm="/api/control/reboot"
        />
        <ConfirmButton
          label="Stow"
          description="Move dish to travel position"
          icon={IconAnchor}
          accentBg="#3d2800" accentColor="#f59e0b" accentBorder="#78350f"
          onConfirm="/api/control/stow"
        />
        <ConfirmButton
          label="Unstow"
          description="Resume normal operation from stow"
          icon={IconRadar}
          accentBg="#0a2d6e" accentColor="#4d9fff" accentBorder="#1a4a9e"
          onConfirm="/api/control/unstow"
        />
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
              <span style={{ fontSize: 10, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </span>
              <span style={{ fontSize: 11, color: '#4a5568' }}>{value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
