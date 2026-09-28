import { useMemo } from 'react'
import { useApi }    from '../hooks/useApi'
import DeviceTable  from '../components/DeviceTable'
import WanDetails   from '../components/WanDetails'

const AUTH_STYLE = {
  WPA3:       { bg: 'var(--good-bg)',  color: '#34d399', border: 'var(--good-border)' },
  'WPA2/WPA3':{ bg: 'var(--good-bg)',  color: '#34d399', border: 'var(--good-border)' },
  WPA2:       { bg: 'var(--info-bg)',  color: 'var(--info)', border: 'var(--info-border)' },
  Open:       { bg: 'var(--warn-bg)',  color: 'var(--warn)', border: 'var(--warn-border)' },
}

export default function Devices() {
  const { data: devResp,  loading } = useApi('/api/devices', 30_000)
  const { data: wanData }           = useApi('/api/wan',     60_000)
  const { data: svcData }           = useApi('/api/service', 60_000)
  const { data: wifiData }          = useApi('/api/wifi',    30_000)

  const devices = devResp?.devices ?? []

  const stats = useMemo(() => {
    if (!devices.length) return null
    const wifi = devices.filter(d => d.band === '5GHz' || d.band === '2.4GHz').length
    const lan  = devices.filter(d => d.band === 'wired').length
    const rx   = devices.reduce((s, d) => s + (d.rx_mbps ?? 0), 0)
    const tx   = devices.reduce((s, d) => s + (d.tx_mbps ?? 0), 0)
    return { wifi, lan, rx, tx }
  }, [devices])

  return (
    <div className="space-y-3">

      {/* ── Network section ── */}
      <div className="rounded-lg p-4 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <WanDetails data={wanData} serviceData={svcData} />

        {/* WiFi Networks */}
        {wifiData?.networks?.length > 0 && (
          <>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="flex items-center justify-between mb-3">
                <p style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  WiFi Networks
                </p>
                {wifiData.bypass_mode && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ background: 'var(--warn-bg)', color: 'var(--warn)', border: '1px solid var(--warn-border)' }}>
                    Bypass / Bridge mode
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {wifiData.networks.map(net => {
                  const authS = AUTH_STYLE[net.auth_type] ?? AUTH_STYLE.WPA2
                  return (
                    <div
                      key={net.iface}
                      className="flex items-center gap-3 rounded-lg px-3 py-2"
                      style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}
                    >
                      {/* Status dot */}
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: net.enabled ? 'var(--good)' : 'var(--text-5)',
                        boxShadow: net.enabled ? '0 0 4px var(--good)' : 'none',
                      }} />

                      {/* Band */}
                      <span style={{ fontSize: 11, color: 'var(--text-4)', width: 56, flexShrink: 0 }}>
                        {net.band}
                      </span>

                      {/* SSID */}
                      <span style={{ fontSize: 12, color: net.enabled ? 'var(--text-2)' : 'var(--text-4)', flex: 1 }}>
                        {net.ssid ?? <span style={{ color: 'var(--text-5)' }}>—</span>}
                        {net.hidden && <span style={{ fontSize: 9, color: 'var(--text-6)', marginLeft: 5 }}>hidden</span>}
                      </span>

                      {/* Auth badge */}
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: authS.bg, color: authS.color, border: `1px solid ${authS.border}` }}>
                        {net.auth_type}
                      </span>

                      {/* Enabled/disabled */}
                      <span style={{ fontSize: 10, color: net.enabled ? 'var(--good)' : 'var(--text-5)', width: 40, textAlign: 'right' }}>
                        {net.enabled ? 'on' : 'off'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Connected Devices section ── */}
      <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <p className="label">Connected Devices</p>

          {stats ? (
            <>
              {stats.wifi > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{ fontSize: 10, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}
                >
                  WiFi: {stats.wifi}
                </span>
              )}
              {stats.lan > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{ fontSize: 10, background: 'var(--info-bg)', color: 'var(--info)', border: '1px solid var(--info-border)' }}
                >
                  LAN: {stats.lan}
                </span>
              )}
              {(stats.rx > 0.1 || stats.tx > 0.1) && (
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-4)' }}>
                  <span style={{ color: 'var(--accent)' }}>↓ {stats.rx.toFixed(1)}</span>
                  <span style={{ color: 'var(--text-6)', margin: '0 3px' }}>/</span>
                  <span style={{ color: 'var(--good)' }}>↑ {stats.tx.toFixed(1)}</span>
                  <span style={{ color: 'var(--text-6)', marginLeft: 3 }}>Mbps total</span>
                </span>
              )}
            </>
          ) : devices.length === 0 && !loading ? null : (
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ fontSize: 10, background: 'var(--accent-bg)', color: 'var(--accent)' }}
            >
              {devices.length}
            </span>
          )}
        </div>

        <DeviceTable devices={devices} loading={loading} />
      </div>

    </div>
  )
}
