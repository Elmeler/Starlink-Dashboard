import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  IconWifi,
  IconNetwork,
  IconRouter,
  IconShieldOff,
  IconPlug,
  IconRefresh,
  IconSettings,
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
} from '@tabler/icons-react'
import { useLive } from '../App'

// ── individual step card ──────────────────────────────────────────────────────

function Step({ icon: Icon, title, children }) {
  return (
    <div
      className="flex gap-3 rounded-lg p-3"
      style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}
    >
      <div className="shrink-0 mt-0.5">
        <Icon size={16} stroke={1.8} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="space-y-1 min-w-0">
        <p style={{ fontSize: 12, color: 'var(--text-1)', fontWeight: 500 }}>{title}</p>
        <div style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.6 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function Code({ children }) {
  return (
    <code
      className="mono"
      style={{
        fontSize: 10,
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        padding: '1px 5px',
        color: 'var(--accent)',
      }}
    >
      {children}
    </code>
  )
}

// ── slim reconnecting banner (shown when data existed, then dish dropped) ─────

export function NoDishBanner() {
  const { settings } = useLive()
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 mb-2"
      style={{ background: 'var(--warn-bg)', border: '1px solid var(--warn-border)' }}
    >
      <IconAlertTriangle size={14} stroke={2} style={{ color: 'var(--warn)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--warn)' }}>
        Lost contact with dish at <span className="mono" style={{ fontSize: 10 }}>{settings.dishAddress}</span>
        {' '}— showing last known data. Reconnecting&hellip;
      </span>
    </div>
  )
}

// ── full panel (shown when no data has ever arrived) ─────────────────────────

export default function NoDishPanel() {
  const { settings } = useLive()
  const [checking, setChecking] = useState(false)
  const [result,   setResult]   = useState(null)   // null | 'ok' | 'fail' | {error}

  async function retry() {
    setChecking(true)
    setResult(null)
    try {
      const r    = await fetch('/api/health', { signal: AbortSignal.timeout(5000) })
      const body = await r.json()
      setResult(body.dish_reachable ? 'ok' : { error: body.error ?? 'Dish not reachable' })
    } catch (err) {
      setResult({ error: err.message ?? 'Request failed' })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-start pt-6 pb-10 px-4 min-h-full">
      <div style={{ maxWidth: 560, width: '100%' }} className="space-y-4">

        {/* ── header ── */}
        <div
          className="rounded-lg p-4 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <div className="flex justify-center mb-3">
            <div
              className="rounded-full flex items-center justify-center"
              style={{ width: 44, height: 44, background: 'var(--bad-bg)', border: '1px solid var(--bad)' }}
            >
              <IconWifi size={22} stroke={1.6} style={{ color: 'var(--bad)' }} />
            </div>
          </div>
          <p style={{ fontSize: 15, color: 'var(--text-1)', fontWeight: 600 }}>
            Dish not reachable
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
            Could not connect to{' '}
            <code
              className="mono"
              style={{ fontSize: 10, color: 'var(--accent)', background: 'var(--accent-bg)', padding: '1px 6px', borderRadius: 3 }}
            >
              {settings.dishAddress}
            </code>
          </p>
        </div>

        {/* ── retry button + result ── */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={retry}
            disabled={checking}
            className="flex items-center gap-2 rounded-lg px-5 py-2 font-medium transition-opacity disabled:opacity-50"
            style={{ fontSize: 12, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
          >
            <IconRefresh size={14} stroke={2} className={checking ? 'animate-spin' : ''} />
            {checking ? 'Checking…' : 'Retry connection'}
          </button>

          {result === 'ok' && (
            <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--good)' }}>
              <IconCircleCheck size={13} stroke={2} />
              Dish reachable — data should appear shortly
            </div>
          )}
          {result?.error && (
            <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--bad)' }}>
              <IconCircleX size={13} stroke={2} />
              {result.error}
            </div>
          )}
        </div>

        {/* ── troubleshooting steps ── */}
        <div
          className="rounded-lg p-4 space-y-1"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <p
            className="font-sans uppercase tracking-widest mb-3"
            style={{ fontSize: 9, color: 'var(--text-5)', letterSpacing: '0.12em' }}
          >
            Troubleshooting
          </p>

          <div className="space-y-2">

            <Step icon={IconNetwork} title="Check your network connection">
              This app must run on a device that can reach the Starlink local subnet{' '}
              <Code>192.168.100.0/24</Code>. If you are connected to the dish through a
              Starlink router, you are typically on <Code>192.168.1.0/24</Code> and the dish
              itself is still reachable at <Code>192.168.100.1</Code> via an internal route
              the router maintains. Verify with:
              <br />
              <Code>ping 192.168.100.1</Code>
            </Step>

            <Step icon={IconRouter} title="Running on a server or Raspberry Pi?">
              If this app is on a machine that is <em>not</em> directly plugged into the Starlink
              dish/router, you need a static route to the dish subnet. Example for Linux:
              <br />
              <Code>{'ip route add 192.168.100.0/24 via <your-gateway>'}</Code>
              <br />
              Replace <Code>&lt;your-gateway&gt;</Code> with the LAN IP of the device that
              connects to the Starlink router (e.g. <Code>192.168.1.1</Code>).
            </Step>

            <Step icon={IconPlug} title="Bypass / IP Passthrough mode">
              If the Starlink dish is in <strong style={{ color: 'var(--text-1)' }}>bypass mode</strong>{' '}
              (plugged directly into your own router), the gRPC API is still available at{' '}
              <Code>192.168.100.1:9200</Code> as long as your router forwards or has a route to
              that subnet. Some routers require adding a static route manually:{' '}
              destination <Code>192.168.100.0/24</Code>, gateway = the WAN-side port that faces
              the dish.
            </Step>

            <Step icon={IconShieldOff} title="Firewall / port blocking">
              Make sure nothing on this machine or the network blocks outbound TCP to{' '}
              <Code>192.168.100.1:9200</Code>. This port uses gRPC (HTTP/2). On Linux:
              <br />
              <Code>{'curl -v --http2 http://192.168.100.1:9200'}</Code>
              <br />
              You should see a gRPC response (not a connection refused error).
            </Step>

            <Step icon={IconSettings} title="Wrong dish address?">
              The default address <Code>192.168.100.1:9200</Code> works for most setups.
              If you have changed it or are using a custom routing setup, update it in{' '}
              <NavLink
                to="/settings"
                style={{ color: 'var(--accent)', textDecoration: 'underline' }}
              >
                Settings
              </NavLink>
              .
            </Step>

          </div>
        </div>

        {/* ── settings shortcut ── */}
        <div className="flex justify-center">
          <NavLink
            to="/settings"
            className="flex items-center gap-2 rounded-lg px-4 py-2 transition-colors"
            style={{ fontSize: 11, color: 'var(--text-4)', border: '1px solid var(--border)', background: 'var(--bg-card)' }}
          >
            <IconSettings size={13} stroke={1.8} />
            Open Settings
          </NavLink>
        </div>

      </div>
    </div>
  )
}
