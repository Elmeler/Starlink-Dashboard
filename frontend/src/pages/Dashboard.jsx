import { useLive } from '../App'
import { useApi }  from '../hooks/useApi'
import ObstructionMap from '../components/ObstructionMap'
import SpeedTest      from '../components/SpeedTest'
import { fmtUptime }  from '../utils/fmt'


function parseHwModel(version) {
  if (!version) return { name: 'Dish', hasTemp: null }
  const v = version.toLowerCase()
  if (v.includes('mini'))                                    return { name: 'Starlink Mini',        hasTemp: false }
  if (v.startsWith('hp1') || v.includes('hp1_'))            return { name: 'HP Gen 1',             hasTemp: false }
  if (v.includes('flat_hp') || v.includes('flat high'))     return { name: 'Flat High Perf',       hasTemp: true  }
  if (v.includes('hp') || v.includes('highperf'))           return { name: 'High Performance',     hasTemp: true  }
  if (v.includes('enterprise'))                             return { name: 'Enterprise',            hasTemp: true  }
  if (v.includes('rev3') || v.includes('gen3'))             return { name: 'Standard Gen 3',       hasTemp: true  }
  if (v.includes('rev2') || v.includes('normal'))           return { name: 'Standard',             hasTemp: true  }
  return { name: 'Dish', hasTemp: null }
}

// ── status colour palette ─────────────────────────────────────────────────────

const STATUS = {
  good:     { border: 'var(--stat-good-border)', bg: 'var(--stat-good-bg)', dot: 'var(--good)', label: 'var(--good)' },
  warning:  { border: 'var(--stat-warn-border)', bg: 'var(--stat-warn-bg)', dot: 'var(--warn)', label: 'var(--warn)' },
  critical: { border: 'var(--stat-crit-border)', bg: 'var(--stat-crit-bg)', dot: 'var(--bad)',  label: 'var(--bad)'  },
  unknown:  { border: 'var(--border)',            bg: 'var(--bg-card)',      dot: 'var(--stat-unk-dot)', label: 'var(--text-4)' },
}

// ── big status card ───────────────────────────────────────────────────────────

function Card({ label, value, unit, sublabel, status = 'unknown', note }) {
  const p = STATUS[status]
  return (
    <div
      className="rounded-xl flex flex-col gap-3"
      style={{
        background:  p.bg,
        border:      `1px solid ${p.border}`,
        padding:     '18px 20px',
        minHeight:   120,
        position:    'relative',
        overflow:    'hidden',
      }}
    >
      {/* Coloured top bar */}
      <div style={{
        position:   'absolute',
        top: 0, left: 0, right: 0,
        height:     3,
        background: p.dot,
        opacity:    status === 'unknown' ? 0.18 : 0.7,
        borderRadius: '12px 12px 0 0',
      }} />

      {/* Label row */}
      <div className="flex items-center gap-2">
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background:  p.dot,
          boxShadow:   status !== 'unknown' ? `0 0 7px ${p.dot}88` : 'none',
        }} />
        <span style={{
          fontSize: 9, color: 'var(--text-4)',
          textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600,
        }}>
          {label}
        </span>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5" style={{ lineHeight: 1 }}>
        <span style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-1)' }}>
          {value ?? '—'}
        </span>
        {unit && (
          <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{unit}</span>
        )}
      </div>

      {/* Status label */}
      <span style={{ fontSize: 11, color: p.label, fontWeight: 500 }}>
        {sublabel ?? '—'}
      </span>

      {/* Optional note line */}
      {note && (
        <span style={{ fontSize: 10, color: 'var(--text-5)', marginTop: -4 }}>{note}</span>
      )}
    </div>
  )
}

// ── status derivation helpers ─────────────────────────────────────────────────

function connStatus(state) {
  if (!state) return 'unknown'
  if (state === 'CONNECTED')        return 'good'
  if (state === 'THERMAL_SHUTDOWN') return 'critical'
  return 'warning'
}

function latStatus(ms) {
  if (ms == null) return 'unknown'
  if (ms < 80)  return 'good'
  if (ms < 150) return 'warning'
  return 'critical'
}

function dropStatus(pct) {
  if (pct == null) return 'unknown'
  if (pct < 1) return 'good'
  if (pct < 3) return 'warning'
  return 'critical'
}

function obstrStatus(pct) {
  if (pct == null) return 'unknown'
  if (pct < 1)  return 'good'
  if (pct < 5)  return 'warning'
  return 'critical'
}

function tempStatus(c, hwModel) {
  if (hwModel?.hasTemp === false) return 'unknown'
  if (c == null) return 'unknown'
  if (c < 70) return 'good'
  if (c < 85) return 'warning'
  return 'critical'
}

function dlStatus(mbps) {
  if (mbps == null) return 'unknown'
  if (mbps >= 1)    return 'good'
  return 'unknown'
}

function svcStatus(svc) {
  if (!svc) return 'unknown'
  const code = svc.disablement_code
  if (code === 'OKAY') {
    const throttled =
      svc.dl_restricted_reason && svc.dl_restricted_reason !== 'NO_LIMIT' ||
      svc.ul_restricted_reason && svc.ul_restricted_reason !== 'NO_LIMIT'
    return throttled ? 'warning' : 'good'
  }
  if (code === 'SLEEPING') return 'unknown'
  return 'critical'
}

function fwStatus(svc) {
  if (!svc) return 'unknown'
  if (svc.sw_update_reboot_required) return 'warning'
  const state = svc.sw_update_state
  if (state === 'IDLE')     return 'good'
  if (state === 'FETCHING') return 'warning'
  if (state === 'STAGED')   return 'warning'
  return 'unknown'
}

function fmtServiceClass(svc) {
  if (!svc) return null
  const parts = [svc.class_of_service, svc.mobility_class]
    .filter(Boolean)
    .map(s => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' '))
  return parts.join(' · ') || null
}

function fmtDisablement(code) {
  if (!code || code === 'OKAY') return null
  const map = {
    NO_SERVICE:       'No service provisioned',
    SLEEPING:         'Sleep mode',
    SWITCH_TO_LOWER:  'Downgraded plan',
    SWITCH_TO_HIGHER: 'Plan change pending',
    OVERDUE_PAYMENT:  'Payment overdue',
    FORBIDDEN_REGION: 'Region not supported',
    TESTING:          'Test / development mode',
  }
  return map[code] ?? code.replace(/_/g, ' ').toLowerCase()
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data }             = useLive()
  const { data: diagData }   = useApi('/api/diagnostics', 60_000)
  const { data: svcData }    = useApi('/api/service',     30_000)
  const d    = data ?? {}
  const diag = diagData ?? {}

  const hwModel      = parseHwModel(d.hardware_version)
  const dishTempRaw  = diag.dish_temp_c  ?? d.dish_temp_c
  const dishTempDisp = dishTempRaw != null ? Math.round(dishTempRaw) : null

  const obstrPct    = diag.fraction_obstructed_pct ?? null
  const stateLabel  = d.state
    ? d.state.charAt(0) + d.state.slice(1).toLowerCase().replace(/_/g, ' ')
    : null
  const uptimeFmt   = fmtUptime(d.uptime_s)

  const statuses = [
    connStatus(d.state),
    latStatus(d.latency_ms),
    dropStatus(d.drop_rate_pct),
    obstrStatus(obstrPct),
    d.snr_above_floor === false ? 'warning' : d.snr_above_floor === true ? 'good' : 'unknown',
  ].filter(s => s !== 'unknown')

  const overallStatus =
    statuses.includes('critical') ? 'critical' :
    statuses.includes('warning')  ? 'warning'  : 'good'

  const overallColor = STATUS[overallStatus].dot

  return (
    <div className="space-y-3 max-w-full">

      {/* ── Overall health bar ── */}
      <div
        className="rounded-lg px-4 py-2.5 flex items-center gap-3"
        style={{ background: STATUS[overallStatus].bg, border: `1px solid ${STATUS[overallStatus].border}` }}
      >
        <span style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: overallColor,
          boxShadow: `0 0 10px ${overallColor}`,
        }} />
        <span style={{ fontSize: 12, color: overallColor, fontWeight: 600 }}>
          {overallStatus === 'good'     ? 'All systems nominal'        :
           overallStatus === 'warning'  ? 'Degraded — check metrics below' :
                                          'Issue detected — action may be needed'}
        </span>
        {d.software_version && (
          <span style={{ fontSize: 9, color: 'var(--text-5)', marginLeft: 'auto' }}>
            fw {d.software_version}
          </span>
        )}
      </div>

      {/* ── Service + Firmware ── */}
      <div className="grid grid-cols-2 gap-3">
        <Card
          label="Service"
          value={
            !svcData                              ? '—'          :
            svcData.disablement_code === 'OKAY'   ? 'Active'     :
            svcData.disablement_code === 'SLEEPING' ? 'Sleeping' :
            'Inactive'
          }
          unit=""
          sublabel={
            !svcData                                                      ? 'Loading…'              :
            svcData.disablement_code !== 'OKAY'                           ? (fmtDisablement(svcData.disablement_code) ?? 'Service issue') :
            (svcData.dl_restricted_reason && svcData.dl_restricted_reason !== 'NO_LIMIT') ? 'Bandwidth limited'  :
            (fmtServiceClass(svcData) ?? 'Plan active')
          }
          status={svcStatus(svcData)}
          note={svcData?.country_code ?? undefined}
        />
        <Card
          label="Firmware"
          value={
            !svcData                                       ? '—'           :
            svcData.sw_update_reboot_required              ? 'Reboot'      :
            svcData.sw_update_state === 'FETCHING'         ? `${Math.round((svcData.sw_update_progress ?? 0) * 100)} %` :
            svcData.sw_update_state === 'STAGED'           ? 'Ready'       :
            'Current'
          }
          unit=""
          sublabel={
            !svcData                                       ? 'Loading…'            :
            svcData.sw_update_reboot_required              ? 'Reboot required to apply update' :
            svcData.sw_update_state === 'FETCHING'         ? 'Downloading update…'  :
            svcData.sw_update_state === 'STAGED'           ? 'Update staged — reboot to apply' :
            'Up to date'
          }
          status={fwStatus(svcData)}
          note={svcData?.software_version ?? undefined}
        />
      </div>

      {/* ── 3 × 3 status card grid ── */}
      <div className="grid grid-cols-3 gap-3">

        <Card
          label="Connection"
          value={stateLabel ?? (d.dish_connected === false ? 'Offline' : '—')}
          unit=""
          sublabel={uptimeFmt ? `up ${uptimeFmt}` : (d.dish_connected === false ? 'Dish unreachable' : 'Waiting for data')}
          status={connStatus(d.state)}
          note={d.hardware_version ?? undefined}
        />
        <Card
          label="Signal Quality"
          value={d.snr_above_floor === true ? 'Good' : d.snr_above_floor === false ? 'Weak' : '—'}
          unit=""
          sublabel={
            d.snr_above_floor === true  ? 'SNR above noise floor' :
            d.snr_above_floor === false ? 'SNR below noise floor' :
            'No data'
          }
          status={
            d.snr_above_floor === true  ? 'good'    :
            d.snr_above_floor === false ? 'warning' :
            'unknown'
          }
          note={d.gps_sats != null ? `${d.gps_sats} GPS satellites` : undefined}
        />
        <Card
          label="Obstruction"
          value={obstrPct != null ? obstrPct.toFixed(1) : '—'}
          unit={obstrPct != null ? '%' : ''}
          sublabel={
            obstrPct == null  ? 'No data'       :
            obstrPct < 1      ? 'Clear sky view' :
            obstrPct < 5      ? 'Minor blockage' :
                                'Significant obstruction'
          }
          status={obstrStatus(obstrPct)}
          note={diag.is_obstructed != null ? (diag.is_obstructed ? 'Currently obstructed' : 'Not currently obstructed') : undefined}
        />

        <Card
          label="Download"
          value={d.download_mbps != null ? d.download_mbps.toFixed(1) : '—'}
          unit={d.download_mbps != null ? 'Mbps' : ''}
          sublabel={
            d.download_mbps == null ? 'No data'      :
            d.download_mbps >= 1    ? 'Transferring'  :
                                      'Idle'
          }
          status={dlStatus(d.download_mbps)}
        />
        <Card
          label="Upload"
          value={d.upload_mbps != null ? d.upload_mbps.toFixed(1) : '—'}
          unit={d.upload_mbps != null ? 'Mbps' : ''}
          sublabel={
            d.upload_mbps == null ? 'No data'     :
            d.upload_mbps >= 1    ? 'Transferring' :
                                    'Idle'
          }
          status={dlStatus(d.upload_mbps)}
        />
        <Card
          label="Latency"
          value={d.latency_ms != null ? Math.round(d.latency_ms) : '—'}
          unit={d.latency_ms != null ? 'ms' : ''}
          sublabel={
            d.latency_ms == null ? 'No data' :
            d.latency_ms < 80   ? 'Normal'   :
            d.latency_ms < 150  ? 'Elevated' :
                                  'High'
          }
          status={latStatus(d.latency_ms)}
        />

        <Card
          label="Packet Loss"
          value={d.drop_rate_pct != null ? d.drop_rate_pct.toFixed(2) : '—'}
          unit={d.drop_rate_pct != null ? '%' : ''}
          sublabel={
            d.drop_rate_pct == null ? 'No data'  :
            d.drop_rate_pct < 1    ? 'None'      :
            d.drop_rate_pct < 3    ? 'Minor'     :
                                     'High loss'
          }
          status={dropStatus(d.drop_rate_pct)}
        />
        <Card
          label="GPS"
          value={d.gps_ready === true ? 'Ready' : d.gps_ready === false ? 'No fix' : '—'}
          unit=""
          sublabel={
            d.gps_ready === true  ? `${d.gps_sats ?? '?'} satellites locked` :
            d.gps_ready === false ? 'Acquiring fix…' :
            'Unknown'
          }
          status={d.gps_ready === true ? 'good' : 'unknown'}
          note={d.gps_enabled === false ? 'GPS reporting disabled' : undefined}
        />
        <Card
          label="Temperature"
          value={
            hwModel.hasTemp === false ? hwModel.name :
            dishTempDisp != null      ? dishTempDisp  :
            '—'
          }
          unit={
            hwModel.hasTemp === false ? '' :
            dishTempRaw != null       ? '°C' :
            ''
          }
          sublabel={
            hwModel.hasTemp === false ? 'No temperature sensor' :
            dishTempRaw == null       ? 'Not reported by hardware' :
            dishTempRaw < 70          ? 'Normal operating range'   :
            dishTempRaw < 85          ? 'Warm'                     :
                                        'Hot — check ventilation'
          }
          status={tempStatus(dishTempRaw, hwModel)}
          note={hwModel.hasTemp !== false && dishTempRaw != null ? hwModel.name : undefined}
        />
      </div>

      {/* ── Sky View ── */}
      <div
        className="rounded-xl p-4 flex flex-col items-center gap-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <span style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
            Sky View
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-6)' }}>
            Signal quality recorded across all pointing directions over time
          </span>
        </div>

        <ObstructionMap
          mapData={diagData?.obstruction_map}
          azimuth={diagData?.pointing?.azimuth_deg ?? d.direction_azimuth}
          elevation={diagData?.pointing?.elevation_deg ?? d.direction_elevation}
          size={280}
          showLegend
        />

        <div
          className="w-full grid grid-cols-4"
          style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}
        >
          {[
            {
              label: 'Obstruction',
              value: diag.fraction_obstructed_pct != null
                ? `${diag.fraction_obstructed_pct.toFixed(1)} %`
                : '—',
              color: obstrStatus(diag.fraction_obstructed_pct) === 'good'     ? 'var(--good)'
                   : obstrStatus(diag.fraction_obstructed_pct) === 'warning'  ? 'var(--warn)'
                   : obstrStatus(diag.fraction_obstructed_pct) === 'critical' ? 'var(--bad)'
                   : 'var(--text-4)',
            },
            {
              label: 'Azimuth',
              value: (diagData?.pointing?.azimuth_deg ?? d.direction_azimuth) != null
                ? `${(diagData?.pointing?.azimuth_deg ?? d.direction_azimuth).toFixed(1)}°`
                : '—',
              color: 'var(--text-3)',
            },
            {
              label: 'Elevation',
              value: (diagData?.pointing?.elevation_deg ?? d.direction_elevation) != null
                ? `${(diagData?.pointing?.elevation_deg ?? d.direction_elevation).toFixed(1)}°`
                : '—',
              color: 'var(--text-3)',
            },
            {
              label: 'Signal',
              value: diag.is_obstructed != null
                ? (diag.is_obstructed ? 'Obstructed' : 'Clear')
                : '—',
              color: diag.is_obstructed ? 'var(--bad)' : 'var(--good)',
            },
          ].map(({ label, value, color }, i) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1"
              style={i > 0 ? { borderLeft: '1px solid var(--border)' } : {}}
            >
              <span style={{ fontSize: 9, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {label}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Speed Test ── */}
      <SpeedTest />

    </div>
  )
}
