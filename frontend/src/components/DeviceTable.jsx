import { useState, useMemo } from 'react'
import {
  IconDeviceMobile,
  IconDeviceLaptop,
  IconDeviceTv,
  IconCpu,
  IconRouter,
  IconDeviceUnknown,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
} from '@tabler/icons-react'
import { getDeviceType } from '../utils/oui'

// ── constants ─────────────────────────────────────────────────────────────────

const BAND_STYLES = {
  '5GHz':    { background: 'var(--accent-bg)', color: 'var(--accent)'  },
  '2.4GHz':  { background: 'var(--good-bg)',   color: 'var(--good)'    },
  'wired':   { background: 'var(--info-bg)',   color: 'var(--info)'    },
  'unknown': { background: 'var(--bg-input)',  color: 'var(--text-5)'  },
}

const BAND_LABEL = { 'wired': 'LAN' }

const DEVICE_ICONS = {
  phone:   IconDeviceMobile,
  laptop:  IconDeviceLaptop,
  tv:      IconDeviceTv,
  iot:     IconCpu,
  router:  IconRouter,
  unknown: IconDeviceUnknown,
}

const SORTABLE_COLS = ['hostname', 'ip', 'signal_dbm', 'snr', 'rx_mbps', 'tx_mbps', 'lease_expiry']

// ── helpers ───────────────────────────────────────────────────────────────────

function signalColor(dbm) {
  if (dbm == null)  return 'var(--text-4)'
  if (dbm > -65)    return 'var(--good)'
  if (dbm >= -75)   return 'var(--warn)'
  return 'var(--bad)'
}

function fmtLease(ts) {
  if (!ts) return '—'
  const diff = ts - Date.now() / 1000
  if (diff <= 0) return <span style={{ color: 'var(--bad)' }}>expired</span>
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0)   return `${h}h ${m}m`
  return `${m}m`
}

function SortIcon({ col, sortKey, sortDir }) {
  if (col !== sortKey)   return <IconSelector   size={11} stroke={1.5} style={{ color: 'var(--text-5)' }} />
  if (sortDir === 'asc') return <IconChevronUp  size={11} stroke={2}   style={{ color: 'var(--accent)' }} />
  return                        <IconChevronDown size={11} stroke={2}   style={{ color: 'var(--accent)' }} />
}

// ── component ─────────────────────────────────────────────────────────────────

export default function DeviceTable({ devices = [], loading = false }) {
  const [search,   setSearch]   = useState('')
  const [band,     setBand]     = useState('all')
  const [sortKey,  setSortKey]  = useState('hostname')
  const [sortDir,  setSortDir]  = useState('asc')

  const filtered = useMemo(() => {
    let out = devices

    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(d =>
        (d.hostname ?? '').toLowerCase().includes(q) ||
        (d.mac ?? '').toLowerCase().includes(q) ||
        (d.ip  ?? '').includes(q)
      )
    }

    if (band !== 'all') {
      out = out.filter(d => d.band === band)
    }

    return [...out].sort((a, b) => {
      let av = a[sortKey] ?? ''
      let bv = b[sortKey] ?? ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [devices, search, band, sortKey, sortDir])

  function handleSort(col) {
    if (!SORTABLE_COLS.includes(col)) return
    if (sortKey === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(col)
      setSortDir('asc')
    }
  }

  const bands = ['all', '5GHz', '2.4GHz', 'wired']
  const bandLabel = b => BAND_LABEL[b] ?? (b === 'all' ? 'All' : b)

  return (
    <div className="flex flex-col gap-2">

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="search"
          placeholder="Search hostname, MAC, IP…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-0 rounded px-3 py-1.5 text-sm outline-none"
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            color: 'var(--text-1)',
            minWidth: 180,
          }}
        />

        <div className="flex gap-1">
          {bands.map(b => (
            <button
              key={b}
              onClick={() => setBand(b)}
              className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                background: band === b ? 'var(--accent-bg)' : 'var(--bg-input)',
                color:      band === b ? 'var(--accent)'    : 'var(--text-4)',
                border:     `1px solid ${band === b ? 'var(--accent-border)' : 'var(--border)'}`,
              }}
            >
              {bandLabel(b)}
            </button>
          ))}
        </div>

        {/* Count badge */}
        <span
          className="ml-auto rounded-full px-2 py-0.5 font-medium"
          style={{ fontSize: 11, background: 'var(--border)', color: 'var(--text-4)' }}
        >
          {filtered.length} device{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 32   }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: 76   }} />
            <col style={{ width: 76   }} />
            <col style={{ width: 64   }} />
            <col style={{ width: 72   }} />
            <col style={{ width: 72   }} />
            <col />
          </colgroup>

          <thead>
            <tr style={{ background: 'var(--tbl-head)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '7px 6px' }} />

              {[
                { key: 'hostname',     label: 'Hostname' },
                { key: 'mac',          label: 'MAC'      },
                { key: 'ip',           label: 'IP'       },
                { key: 'band',         label: 'Band'     },
                { key: 'signal_dbm',   label: 'Signal'   },
                { key: 'snr',          label: 'SNR'      },
                { key: 'rx_mbps',      label: 'RX'       },
                { key: 'tx_mbps',      label: 'TX'       },
                { key: 'lease_expiry', label: 'Lease'    },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="text-left select-none"
                  style={{
                    padding: '7px 8px',
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: sortKey === key ? 'var(--accent)' : 'var(--text-4)',
                    cursor: SORTABLE_COLS.includes(key) ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {SORTABLE_COLS.includes(key) && (
                      <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="text-center py-8" style={{ color: 'var(--text-4)', fontSize: 12 }}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center py-10">
                  <p style={{ color: 'var(--text-5)', fontSize: 12 }}>
                    {devices.length === 0
                      ? 'No devices — requires Starlink router on the local network'
                      : 'No devices match the current filter'}
                  </p>
                </td>
              </tr>
            )}

            {filtered.map((d, i) => {
              const type    = getDeviceType(d.mac)
              const Icon    = DEVICE_ICONS[type] ?? IconDeviceUnknown
              const bandSty = BAND_STYLES[d.band] ?? BAND_STYLES.unknown

              return (
                <tr
                  key={d.mac ?? i}
                  style={{
                    borderTop: i === 0 ? 'none' : '0.5px solid var(--border-dim)',
                  }}
                  className="hover:bg-hoverbg transition-colors"
                >
                  {/* Device icon */}
                  <td style={{ padding: '6px 6px 6px 10px' }}>
                    <div style={{ position: 'relative', lineHeight: 0 }}>
                      <Icon size={15} stroke={1.5} style={{ color: 'var(--text-5)' }} />
                      {d.active && (
                        <span
                          style={{
                            position: 'absolute', bottom: -1, right: -2,
                            width: 5, height: 5, borderRadius: '50%',
                            background: 'var(--good)',
                          }}
                        />
                      )}
                    </div>
                  </td>

                  {/* Hostname */}
                  <td style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.hostname || <span style={{ color: 'var(--text-5)' }}>Unknown</span>}
                  </td>

                  {/* MAC */}
                  <td style={{ padding: '6px 8px' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                      {d.mac || '—'}
                    </span>
                  </td>

                  {/* IP */}
                  <td style={{ padding: '6px 8px' }}>
                    <span className="mono" style={{ fontSize: 11, color: d.ip ? 'var(--text-mono)' : 'var(--text-5)' }}>
                      {d.ip || '—'}
                    </span>
                  </td>

                  {/* Band badge */}
                  <td style={{ padding: '6px 8px' }}>
                    {d.band && d.band !== 'unknown' ? (
                      <span className="inline-block rounded px-1.5 py-0.5" style={{ fontSize: 10, fontWeight: 500, ...bandSty }}>
                        {BAND_LABEL[d.band] ?? d.band}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-5)', fontSize: 10 }}>—</span>
                    )}
                  </td>

                  {/* Signal */}
                  <td style={{ padding: '6px 8px' }}>
                    {d.signal_dbm != null ? (
                      <span className="mono" style={{ fontSize: 11, color: signalColor(d.signal_dbm) }}>
                        {d.signal_dbm} dBm
                      </span>
                    ) : <span style={{ color: 'var(--text-5)', fontSize: 11 }}>—</span>}
                  </td>

                  {/* SNR */}
                  <td style={{ padding: '6px 8px' }}>
                    {d.snr != null ? (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>
                        {d.snr.toFixed(1)} dB
                      </span>
                    ) : <span style={{ color: 'var(--text-5)', fontSize: 11 }}>—</span>}
                  </td>

                  {/* RX */}
                  <td style={{ padding: '6px 8px' }}>
                    {d.rx_mbps != null ? (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                        {d.rx_mbps.toFixed(1)}
                      </span>
                    ) : <span style={{ color: 'var(--text-5)', fontSize: 11 }}>—</span>}
                  </td>

                  {/* TX */}
                  <td style={{ padding: '6px 8px' }}>
                    {d.tx_mbps != null ? (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--good)' }}>
                        {d.tx_mbps.toFixed(1)}
                      </span>
                    ) : <span style={{ color: 'var(--text-5)', fontSize: 11 }}>—</span>}
                  </td>

                  {/* Lease expiry */}
                  <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text-4)' }}>
                    {fmtLease(d.lease_expiry)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
