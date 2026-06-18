import { useApi }     from '../hooks/useApi'
import DeviceTable   from '../components/DeviceTable'
import WanDetails    from '../components/WanDetails'

export default function Devices() {
  const { data: devResp, loading } = useApi('/api/devices', 30_000)
  const { data: wanData }          = useApi('/api/wan',     60_000)

  const devices = devResp?.devices ?? []

  return (
    <div className="flex gap-3 min-h-0">

      {/* ── Device table (fills remaining width) ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <p className="label">Connected devices</p>
          {devices.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 font-medium"
              style={{ fontSize: 10, background: 'var(--sl-accent-bg)', color: 'var(--sl-accent)' }}
            >
              {devices.length}
            </span>
          )}
        </div>
        <DeviceTable devices={devices} loading={loading} />
      </div>

      {/* ── WAN details sidebar ── */}
      <div
        className="rounded-lg p-4 shrink-0"
        style={{
          width: 220,
          background: 'var(--sl-surface)',
          border: '1px solid var(--sl-border)',
          alignSelf: 'flex-start',
        }}
      >
        <WanDetails data={wanData} />
      </div>
    </div>
  )
}
