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
  '5GHz':    { background: 'var(--sl-accent-bg)',   color: 'var(--sl-accent)'   },
  '2.4GHz':  { background: 'var(--sl-success-dim)', color: 'var(--sl-success)'  },
  'wired':   { background: 'var(--sl-border)',       color: 'var(--sl-text-lo)'  },
  'unknown': { background: 'var(--sl-surface-alt)', color: 'var(--sl-text-dim)' },
}

const DEVICE_ICONS = {
  phone:   IconDeviceMobile,
  laptop:  IconDeviceLaptop,
  tv:      IconDeviceTv,
  iot:     IconCpu,
  router:  IconRouter,
  unknown: IconDeviceUnknown,
}

const SORTABLE_COLS = ['hostname', 'ip', 'signal_dbm', 'lease_expiry']

// ── helpers ───────────────────────────────────────────────────────────────────

function signalColor(dbm) {
  if (dbm == null)  return 'var(--sl-text-lo)'
  if (dbm > -65)    return '#22c55e'
  if (dbm >= -75)   return '#f59e0b'
  return '#ef4444'
}

function fmtLease(ts) {
  if (!ts) return '—'
  const diff = ts - Date.now() / 1000
  if (diff <= 0) return <span style={{ color: 'var(--sl-danger)' }}>expired</span>
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0)   return `${h}h ${m}m`
  return `${m}m`
}

function SortIcon({ col, sortKey, sortDir }) {
  if (col !== sortKey)   return <IconSelector   size={11} stroke={1.5} style={{ color: 'var(--sl-text-dim)' }} />
  if (sortDir === 'asc') return <IconChevronUp  size={11} stroke={2}   style={{ color: 'var(--sl-accent)'   }} />
  return                        <IconChevronDown size={11} stroke={2}   style={{ color: 'var(--sl-accent)'   }} />
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
            background: 'var(--sl-surface-alt)',
            border: '1px solid var(--sl-border)',
            color: 'var(--sl-text-hi)',
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
                background: band === b ? 'var(--sl-accent-bg)'     : 'var(--sl-surface-alt)',
                color:      band === b ? 'var(--sl-accent)'         : 'var(--sl-text-lo)',
                border:     `1px solid ${band === b ? 'var(--sl-accent-border)' : 'var(--sl-border)'}`,
              }}
            >
              {b === 'all' ? 'All' : b}
            </button>
          ))}
        </div>

        {/* Count badge */}
        <span
          className="ml-auto rounded-full px-2 py-0.5 font-medium"
          style={{ fontSize: 11, background: 'var(--sl-border)', color: 'var(--sl-text-lo)' }}
        >
          {filtered.length} device{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--sl-border)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 32  }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: 88  }} />
            <col style={{ width: 84  }} />
            <col />
          </colgroup>

          <thead>
            <tr style={{ background: 'var(--sl-surface-alt)', borderBottom: '1px solid var(--sl-border)' }}>
              <th style={{ padding: '7px 6px' }} />

              {[
                { key: 'hostname',     label: 'Hostname'     },
                { key: 'mac',          label: 'MAC'          },
                { key: 'ip',           label: 'IP'           },
                { key: 'band',         label: 'Band'         },
                { key: 'signal_dbm',   label: 'Signal'       },
                { key: 'lease_expiry', label: 'Lease'        },
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
                    color: sortKey === key ? 'var(--sl-accent)' : 'var(--sl-text-lo)',
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
                <td colSpan={7} className="text-center py-8" style={{ color: 'var(--sl-text-lo)', fontSize: 12 }}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  <p style={{ color: 'var(--sl-text-dim)', fontSize: 12 }}>
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
                    borderTop: i === 0 ? 'none' : `0.5px solid var(--sl-border-subtle)`,
                  }}
                  className="hover:bg-hoverbg transition-colors"
                >
                  {/* Device icon */}
                  <td style={{ padding: '6px 6px 6px 10px' }}>
                    <Icon size={15} stroke={1.5} style={{ color: 'var(--sl-text-dim)' }} />
                  </td>

                  {/* Hostname */}
                  <td style={{ padding: '6px 8px', fontSize: 12, color: 'var(--sl-text-med)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.hostname || <span style={{ color: 'var(--sl-text-dim)' }}>Unknown</span>}
                  </td>

                  {/* MAC */}
                  <td style={{ padding: '6px 8px' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--sl-text-lo)' }}>
                      {d.mac || '—'}
                    </span>
                  </td>

                  {/* IP */}
                  <td style={{ padding: '6px 8px' }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--sl-text-med)' }}>
                      {d.ip || '—'}
                    </span>
                  </td>

                  {/* Band badge */}
                  <td style={{ padding: '6px 8px' }}>
                    {d.band && d.band !== 'unknown' ? (
                      <span
                        className="inline-block rounded px-1.5 py-0.5"
                        style={{ fontSize: 10, fontWeight: 500, ...bandSty }}
                      >
                        {d.band}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--sl-text-dim)', fontSize: 10 }}>—</span>
                    )}
                  </td>

                  {/* Signal */}
                  <td style={{ padding: '6px 8px' }}>
                    {d.signal_dbm != null ? (
                      <span
                        className="mono"
                        style={{ fontSize: 11, color: signalColor(d.signal_dbm) }}
                      >
                        {d.signal_dbm} dBm
                      </span>
                    ) : (
                      <span style={{ color: 'var(--sl-text-dim)', fontSize: 11 }}>—</span>
                    )}
                  </td>

                  {/* Lease expiry */}
                  <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--sl-text-lo)' }}>
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
