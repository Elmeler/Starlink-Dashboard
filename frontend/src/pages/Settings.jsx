import { useState, useCallback } from 'react'
import {
  IconPlugConnected, IconPlugConnectedX, IconRefresh,
  IconRadar, IconPower, IconAnchor, IconServer,
} from '@tabler/icons-react'
import { useLive } from '../App'
import { useApi }  from '../hooks/useApi'

// ── shared primitives ─────────────────────────────────────────────────────────

function Card({ title, children }) {
  return (
    <div
      className="rounded-lg p-4 space-y-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
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
        <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{label}</span>
        {hint && <span style={{ fontSize: 10, color: 'var(--text-5)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function ConfirmButton({ label, description, icon: Icon, accentBg, accentColor, accentBorder, onConfirm }) {
  const [armed,  setArmed]  = useState(false)
  const [busy,   setBusy]   = useState(false)
  const [result, setResult] = useState(null)
  const [errMsg, setErrMsg] = useState('')

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
            background: armed ? accentBg    : 'var(--bg-input)',
            color:      armed ? accentColor : 'var(--text-4)',
            border:     `1px solid ${armed ? accentBorder : 'var(--border)'}`,
            whiteSpace: 'nowrap',
            minWidth: 90,
          }}
        >
          {busy
            ? <IconRefresh size={13} stroke={2} className="animate-spin" />
            : <Icon size={13} stroke={2} />}
          {armed ? 'Confirm?' : label}
        </button>
        <span style={{ fontSize: 10, color: 'var(--text-5)' }}>{description}</span>
      </div>
      {result === 'ok'  && <p style={{ fontSize: 10, color: 'var(--good)' }}>Done</p>}
      {result === 'err' && <p style={{ fontSize: 10, color: 'var(--bad)' }}>{errMsg}</p>}
    </div>
  )
}

function fmtTs(ts) {
  if (!ts) return null
  return new Date(ts * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

// ── WiFi settings ─────────────────────────────────────────────────────────────

function WifiNetworkRow({ net }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <span style={{ fontSize: 10, color: 'var(--text-4)', width: 52, flexShrink: 0 }}>{net.band}</span>
        <span style={{ fontSize: 12, color: 'var(--text-1)', flex: 1 }}>{net.ssid}</span>
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{
            fontSize: 10,
            background: net.enabled ? 'var(--good-bg)' : 'var(--bg-input)',
            color:      net.enabled ? 'var(--good)'    : 'var(--text-5)',
            border:     `1px solid ${net.enabled ? 'var(--good-border)' : 'var(--border)'}`,
          }}
        >
          {net.enabled ? 'On' : 'Off'}
        </span>
        <span
          className="rounded px-2 py-0.5"
          style={{
            fontSize: 10,
            background: 'var(--bg-input)',
            color: 'var(--text-4)',
            border: '1px solid var(--border)',
          }}
        >
          {net.auth_type}
        </span>
      </div>
    </div>
  )
}

function WifiCard() {
  const { data: wifiData } = useApi('/api/wifi', 30_000)

  if (!wifiData) return (
    <Card title="WiFi">
      <p style={{ fontSize: 11, color: 'var(--text-5)' }}>Requires Starlink router on the local network</p>
    </Card>
  )
  if (!wifiData.networks?.length) return (
    <Card title="WiFi">
      <p style={{ fontSize: 11, color: 'var(--text-5)' }}>No WiFi networks found</p>
    </Card>
  )

  return (
    <Card title="WiFi">
      <div className="space-y-2">
        {wifiData.networks.map(net => (
          <WifiNetworkRow key={net.iface} net={net} />
        ))}
      </div>
      <div
        className="rounded-lg px-3 py-2.5 space-y-1"
        style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
      >
        <p style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 500 }}>
          WiFi changes require the Starlink app
        </p>
        <p style={{ fontSize: 10, color: 'var(--warn)', opacity: 0.8, lineHeight: 1.5 }}>
          The router enforces write operations via cryptographic authentication only the official app can produce.
          To change SSID, password, or band settings, use the Starlink app → WiFi settings.
        </p>
      </div>
    </Card>
  )
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { settings, updateSetting, connected, dishConnected, data } = useLive()
  const hasActuators = data?.has_actuators
  const { data: svc } = useApi('/api/service', 60_000)

  // GPS
  const [gpsBusy,   setGpsBusy]   = useState(false)
  const [gpsResult, setGpsResult] = useState(null)
  const [gpsErr,    setGpsErr]    = useState('')

  const toggleGps = useCallback(async (enable) => {
    setGpsBusy(true)
    setGpsResult(null)
    try {
      const r    = await fetch(`/api/control/gps/${enable ? 'enable' : 'disable'}`, { method: 'POST' })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body.detail ?? `HTTP ${r.status}`)
      setGpsResult('ok')
    } catch (e) {
      setGpsResult('err')
      setGpsErr(e.message)
    } finally {
      setGpsBusy(false)
      setTimeout(() => setGpsResult(null), 5000)
    }
  }, [])

  // Dish address
  const [ipDraft,     setIpDraft]     = useState(settings.dishAddress)
  const [testStatus,  setTestStatus]  = useState(null)
  const [testMessage, setTestMessage] = useState('')

  async function testConnection() {
    setTestStatus('testing')
    setTestMessage('')
    try {
      const r    = await fetch('/api/health?live=true', { signal: AbortSignal.timeout(5000) })
      const body = await r.json()
      if (body.dish_reachable) {
        setTestStatus('ok')
        setTestMessage(`Dish reachable at ${body.dish_address}`)
      } else {
        setTestStatus('fail')
        setTestMessage(body.error ?? 'Dish not reachable')
      }
    } catch (err) {
      setTestStatus('fail')
      setTestMessage(err.message ?? 'Request failed')
    }
  }

  function saveIp() {
    if (ipDraft.trim()) updateSetting('dishAddress', ipDraft.trim())
  }

  const testColor = testStatus === 'ok' ? 'var(--good)' : testStatus === 'fail' ? 'var(--bad)' : testStatus === 'testing' ? 'var(--warn)' : 'transparent'

  return (
    <div className="max-w-4xl">
      <div className="grid gap-3 items-start" style={{ gridTemplateColumns: '1fr 1fr' }}>

      {/* ── Left column ── */}
      <div className="space-y-3">

      {/* ── Connection ── */}
      <Card title="Connection">
        <FieldRow label="Dish address" hint="host:port">
          <div className="flex gap-2">
            <input
              type="text"
              value={ipDraft}
              onChange={e => setIpDraft(e.target.value)}
              onBlur={saveIp}
              onKeyDown={e => e.key === 'Enter' && saveIp()}
              className="flex-1 rounded px-3 py-1.5 mono outline-none"
              style={{ fontSize: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              spellCheck={false}
            />
            <button
              onClick={testConnection}
              disabled={testStatus === 'testing'}
              className="flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-opacity disabled:opacity-50"
              style={{ fontSize: 12, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)', whiteSpace: 'nowrap' }}
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
              style={{ background: testStatus === 'ok' ? 'var(--good-bg)' : 'var(--bad-bg)', border: `1px solid ${testColor}` }}
            >
              {testStatus === 'ok'
                ? <IconPlugConnected  size={13} stroke={2} style={{ color: 'var(--good)', flexShrink: 0 }} />
                : <IconPlugConnectedX size={13} stroke={2} style={{ color: 'var(--bad)',  flexShrink: 0 }} />}
              <span style={{ fontSize: 11, color: testColor }}>{testMessage}</span>
            </div>
          )}
        </FieldRow>

        {/* Live status */}
        <div
          className="rounded-lg px-3 py-2.5 flex items-center justify-between"
          style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: connected ? 'var(--good)' : 'var(--text-4)',
              boxShadow: connected ? '0 0 5px var(--good)' : 'none',
            }} />
            <span style={{ fontSize: 11, color: connected ? 'var(--good)' : 'var(--text-4)', fontWeight: 500 }}>
              {connected ? 'Live · 1 s' : 'WebSocket disconnected'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: dishConnected ? 'var(--good)' : 'var(--bad)',
            }} />
            <span style={{ fontSize: 10, color: dishConnected ? 'var(--text-4)' : 'var(--bad)' }}>
              Dish {dishConnected ? 'reachable' : 'unreachable'}
            </span>
          </div>
        </div>
      </Card>

      {/* ── Controls ── */}
      <Card title="Controls">
        {/* Firmware update banners */}
        {svc?.sw_update_state === 'FETCHING' && (
          <div
            className="rounded-lg px-3 py-2 space-y-2"
            style={{ background: 'var(--info-bg)', border: '1px solid var(--info-border)' }}
          >
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 12, color: 'var(--info)', fontWeight: 500 }}>Downloading firmware update…</p>
              {svc.sw_update_progress > 0 && (
                <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                  {Math.round(svc.sw_update_progress * 100)}%
                </p>
              )}
            </div>
            {svc.sw_update_progress > 0 && (
              <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(svc.sw_update_progress * 100)}%`, background: 'var(--accent)' }}
                />
              </div>
            )}
          </div>
        )}

        {svc?.sw_update_reboot_required && (
          <div
            className="rounded-lg px-3 py-2 flex items-start gap-2"
            style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
          >
            <span style={{ fontSize: 10, color: 'var(--warn)', marginTop: 1 }}>⚠</span>
            <div>
              <p style={{ fontSize: 12, color: 'var(--warn)', fontWeight: 500 }}>Software update pending — reboot required</p>
              {svc.sw_update_reboot_ts && (
                <p style={{ fontSize: 10, color: 'var(--warn)', marginTop: 2, opacity: 0.7 }}>
                  Scheduled: {fmtTs(svc.sw_update_reboot_ts)}
                </p>
              )}
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-4)' }}>
          Click once to arm, again to confirm.
        </p>

        <ConfirmButton
          label="Reboot dish"
          description="Drops connection for ~60 s"
          icon={IconPower}
          accentBg="var(--bad-bg)" accentColor="var(--bad)" accentBorder="var(--bad-border)"
          onConfirm="/api/control/reboot"
        />
        {hasActuators !== false && (
          <>
            <ConfirmButton
              label="Stow"
              description="Move dish to travel position"
              icon={IconAnchor}
              accentBg="var(--warn-bg)" accentColor="var(--warn)" accentBorder="var(--warn-border)"
              onConfirm="/api/control/stow"
            />
            <ConfirmButton
              label="Unstow"
              description="Resume normal operation"
              icon={IconRadar}
              accentBg="var(--accent-bg)" accentColor="var(--accent)" accentBorder="var(--accent-border)"
              onConfirm="/api/control/unstow"
            />
          </>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <p style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 6 }}>GPS location reporting</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleGps(true)}
              disabled={gpsBusy}
              className="rounded px-3 py-1.5 font-medium transition-opacity disabled:opacity-40"
              style={{ fontSize: 12, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
            >
              {gpsBusy ? 'Sending…' : 'Enable'}
            </button>
            <button
              onClick={() => toggleGps(false)}
              disabled={gpsBusy}
              className="rounded px-3 py-1.5 font-medium transition-opacity disabled:opacity-40"
              style={{ fontSize: 12, background: 'var(--bg-input)', color: 'var(--text-4)', border: '1px solid var(--border)' }}
            >
              Disable
            </button>
            {gpsResult === 'ok'  && <span style={{ fontSize: 11, color: 'var(--good)' }}>✓ Done</span>}
            {gpsResult === 'err' && <span style={{ fontSize: 11, color: 'var(--bad)' }}>✗ {gpsErr}</span>}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4 }}>
          <ConfirmButton
            label="Restart backend"
            description="Re-runs the Python process — clears in-memory history"
            icon={IconServer}
            accentBg="var(--accent-bg)" accentColor="var(--accent)" accentBorder="var(--accent-border)"
            onConfirm="/api/control/restart-backend"
          />
        </div>
      </Card>

      </div>{/* end left column */}

      {/* ── Right column ── */}
      <div className="space-y-3">

      {/* ── WiFi ── */}
      <WifiCard />

      </div>{/* end right column */}
      </div>{/* end grid */}
    </div>
  )
}
