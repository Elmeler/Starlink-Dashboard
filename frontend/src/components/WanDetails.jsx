import { useState } from 'react'
import { IconCopy, IconCheck } from '@tabler/icons-react'

const PLAN_LABEL = {
  RESIDENTIAL: { label: 'Residential', bg: 'var(--info-bg)',   color: 'var(--info)',   border: 'var(--info-border)'   },
  BUSINESS:    { label: 'Business',    bg: 'var(--good-bg)',   color: 'var(--good)',   border: 'var(--good-border)'   },
  MOBILE:      { label: 'Mobile',      bg: 'var(--accent-bg)', color: 'var(--accent)', border: 'var(--accent-border)' },
  ROAMING:     { label: 'Roaming',     bg: 'var(--warn-bg)',   color: 'var(--warn)',   border: 'var(--warn-border)'   },
}

function PlanBadge({ value }) {
  if (!value) return null
  const s = PLAN_LABEL[value] ?? { bg: 'var(--bg-input)', color: 'var(--text-4)', border: 'var(--border)' }
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {s.label ?? value}
    </span>
  )
}

export default function WanDetails({ data = null, serviceData = null }) {
  const [copied, setCopied] = useState(false)
  const cgnat  = data?.nat_type === 'CGNAT'
  const hasIpv6 = !!data?.ipv6_address

  function copyIp() {
    if (!data?.wan_ip) return
    navigator.clipboard.writeText(data.wan_ip).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div>
      <p className="label mb-3">Network</p>

      {!data ? (
        <p style={{ fontSize: 11, color: 'var(--text-5)' }}>
          Requires Starlink router on the local network
        </p>
      ) : (
        <div className="space-y-3">

          {/* IP row */}
          <div className="flex items-start gap-5 flex-wrap">
            <div>
              <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                External IP
              </p>
              <div className="flex items-center gap-2">
                <p className="mono" style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '0.02em' }}>
                  {data.wan_ip ?? <span style={{ color: 'var(--text-5)' }}>—</span>}
                </p>
                {data.wan_ip && (
                  <button
                    onClick={copyIp}
                    title="Copy IP"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: copied ? 'var(--good)' : 'var(--text-6)', padding: 2, lineHeight: 0,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => { if (!copied) e.currentTarget.style.color = 'var(--text-4)' }}
                    onMouseLeave={e => { if (!copied) e.currentTarget.style.color = 'var(--text-6)' }}
                  >
                    {copied
                      ? <IconCheck size={14} stroke={2} />
                      : <IconCopy  size={14} stroke={1.8} />
                    }
                  </button>
                )}
              </div>
            </div>

            {/* Badges: NAT, IPv6, plan context */}
            <div className="flex flex-wrap gap-2 items-center" style={{ marginTop: 6 }}>
              {data.nat_type && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: cgnat ? 'var(--warn-bg)' : 'var(--good-bg)',
                    color:      cgnat ? 'var(--warn)'    : 'var(--good)',
                    border:     `1px solid ${cgnat ? 'var(--warn-border)' : 'var(--good-border)'}`,
                  }}
                >
                  NAT: {data.nat_type}
                </span>
              )}

              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  background: hasIpv6 ? 'var(--good-bg)' : 'var(--bg-input)',
                  color:      hasIpv6 ? 'var(--good)'    : 'var(--text-4)',
                  border:     `1px solid ${hasIpv6 ? 'var(--good-border)' : 'var(--border)'}`,
                }}
              >
                IPv6: {hasIpv6 ? 'enabled' : 'disabled'}
              </span>

              {serviceData?.class_of_service && (
                <PlanBadge value={serviceData.class_of_service} />
              )}
              {serviceData?.mobility_class && serviceData.mobility_class !== 'STATIONARY' && (
                <PlanBadge value={serviceData.mobility_class} />
              )}
              {serviceData?.country_code && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: 'var(--bg-input)', color: 'var(--text-4)', border: '1px solid var(--border)' }}
                >
                  {serviceData.country_code}
                </span>
              )}
            </div>
          </div>

          {/* CGNAT info note */}
          {cgnat && (
            <div
              className="rounded-lg px-3 py-2 flex flex-col gap-1"
              style={{ background: 'var(--bg-inner)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-baseline gap-2">
                <span style={{ fontSize: 10, color: 'var(--text-5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>IPv4</span>
                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                  Shared address (CGNAT) — normal for Starlink. Outbound traffic is unaffected; port forwarding is not available.
                </span>
              </div>
              {hasIpv6 && (
                <div className="flex items-baseline gap-2">
                  <span style={{ fontSize: 10, color: 'var(--text-5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>IPv6</span>
                  <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                    Dedicated global address — inbound connections and self-hosting work over IPv6.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Detail grid */}
          <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>

            <div>
              <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                DNS Servers
              </p>
              {data.dns_servers?.length ? (
                data.dns_servers.map(d => (
                  <p key={d} className="mono" style={{ fontSize: 11, color: 'var(--text-mono)' }}>{d}</p>
                ))
              ) : (
                <p style={{ fontSize: 11, color: 'var(--text-4)' }}>ISP default</p>
              )}
            </div>

            {hasIpv6 && (
              <div>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  IPv6 Address
                </p>
                <p className="mono" style={{ fontSize: 10, color: 'var(--good)', wordBreak: 'break-all' }}>
                  {data.ipv6_address}
                </p>
              </div>
            )}

            {data.ssid && (
              <div>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  WiFi SSID
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{data.ssid}</p>
              </div>
            )}

            {data.router_sw && (
              <div>
                <p style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  Router Firmware
                </p>
                <p className="mono" style={{ fontSize: 10, color: 'var(--text-4)' }}>{data.router_sw}</p>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
