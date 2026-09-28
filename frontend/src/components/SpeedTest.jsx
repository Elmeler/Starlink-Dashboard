import { useState, useRef } from 'react'

// All traffic goes directly from the browser to Cloudflare through Starlink.
// Cloudflare's speed test endpoints support CORS and are designed for this.
const CF      = 'https://speed.cloudflare.com'
const DL_URL  = `${CF}/__down?bytes=26214400`   // 25 MB download
const UL_URL  = `${CF}/__up`                    // upload target
const PING_URL = `${CF}/__down?bytes=1`         // 1-byte round-trip for latency

const UPLOAD_BYTES = 10 * 1024 * 1024
let _uploadBuf = null
function getUploadBuf() {
  if (!_uploadBuf) _uploadBuf = new ArrayBuffer(UPLOAD_BYTES)
  return _uploadBuf
}
const MAX_MBPS     = 300

// ── helpers ───────────────────────────────────────────────────────────────────

function speedColor(mbps) {
  if (mbps == null) return 'var(--border)'
  if (mbps >= 25)   return 'var(--good)'
  if (mbps >= 5)    return 'var(--warn)'
  return 'var(--bad)'
}
function speedLabel(mbps) {
  if (mbps == null)  return ''
  if (mbps >= 100)   return 'Excellent'
  if (mbps >= 25)    return 'Good'
  if (mbps >= 5)     return 'Fair'
  return 'Slow'
}
function pingColor(ms) {
  if (ms == null) return 'var(--border)'
  if (ms < 80)    return 'var(--good)'
  if (ms < 150)   return 'var(--warn)'
  return 'var(--bad)'
}
function pingLabel(ms) {
  if (ms == null)  return ''
  if (ms < 60)     return 'Excellent'
  if (ms < 80)     return 'Good'
  if (ms < 150)    return 'Elevated'
  return 'High'
}
function fmtMbps(v) {
  if (v == null)  return '—'
  if (v >= 100)   return v.toFixed(0)
  if (v >= 10)    return v.toFixed(1)
  return v.toFixed(2)
}

// ── arc gauge ─────────────────────────────────────────────────────────────────
// 270° arc, gap at bottom. Uses stroke-dasharray on a circle rotated 135°.

function ArcGauge({ speed, phase, running }) {
  const SIZE  = 150
  const cx    = SIZE / 2
  const cy    = SIZE / 2
  const R     = 60
  const THICK = 8
  const circ  = 2 * Math.PI * R
  const arcLen   = circ * 0.75
  const gapLen   = circ - arcLen
  const dashArr  = `${arcLen} ${gapLen}`
  const fraction = speed != null ? Math.min(speed / MAX_MBPS, 1) : 0
  const filled   = arcLen * fraction
  const fgOffset = arcLen - filled
  const color    = running ? speedColor(speed) : 'var(--border)'

  const phaseText =
    phase === 'latency'  ? 'Latency…'  :
    phase === 'download' ? 'Download…' :
    phase === 'upload'   ? 'Upload…'   :
    phase === 'done'     ? 'Done'      : ''

  return (
    <div className="flex flex-col items-center" style={{ width: SIZE }}>
      <svg width={SIZE} height={SIZE}>
        <circle
          cx={cx} cy={cy} r={R}
          fill="none" stroke="var(--bg-input)" strokeWidth={THICK}
          strokeDasharray={dashArr} strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        <circle
          cx={cx} cy={cy} r={R}
          fill="none" stroke={color} strokeWidth={THICK}
          strokeDasharray={dashArr} strokeDashoffset={fgOffset}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
          style={{ transition: 'stroke-dashoffset 0.25s ease-out, stroke 0.3s ease' }}
          filter={running && speed > 0 ? `drop-shadow(0 0 5px ${color})` : undefined}
        />
        <text
          x={cx} y={cy - 7}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={speed != null && speed >= 100 ? 28 : 32}
          fontWeight={700}
          fill={running ? (speed != null ? color : 'var(--text-5)') : 'var(--text-5)'}
          fontFamily="Space Grotesk, sans-serif"
          style={{ transition: 'fill 0.3s ease', fontVariantNumeric: 'tabular-nums' }}
        >
          {running && speed != null ? fmtMbps(speed) : '—'}
        </text>
        {running && speed != null && (
          <text
            x={cx} y={cy + 17}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={11} fontWeight={500} fill="var(--text-4)"
            fontFamily="Space Grotesk, sans-serif"
          >
            Mbps
          </text>
        )}
        {phase === 'latency' && (
          <circle cx={cx} cy={cy} r={3} fill="var(--accent)">
            <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      {phaseText && (
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', marginTop: -8,
          color: running ? 'var(--accent)' : 'var(--text-4)',
        }}>
          {phaseText}
        </span>
      )}
    </div>
  )
}

// ── result row ────────────────────────────────────────────────────────────────

function ResultRow({ label, value, unit, color, sub, border }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={border ? { borderTop: '1px solid var(--border)' } : {}}
    >
      <span style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: 70 }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{unit}</span>}
      </div>
      <span style={{ fontSize: 10, color, opacity: 0.7, minWidth: 56, textAlign: 'right' }}>{sub}</span>
    </div>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function SpeedTest() {
  const [phase,     setPhase]     = useState('idle')
  const [liveSpeed, setLiveSpeed] = useState(null)
  const [results,   setResults]   = useState(null)
  const [errMsg,    setErrMsg]    = useState('')
  const abortRef = useRef(null)
  const xhrRef   = useRef(null)

  const running = phase === 'latency' || phase === 'download' || phase === 'upload'

  function cancel() {
    abortRef.current?.abort()
    xhrRef.current?.abort()
    setPhase('idle')
    setLiveSpeed(null)
  }

  async function run() {
    const abort = new AbortController()
    abortRef.current = abort
    setResults(null)
    setErrMsg('')
    setLiveSpeed(null)

    try {
      // ── 1. Latency — 5 pings to Cloudflare, take median ─────────────────
      setPhase('latency')
      const pings = []
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now()
        await fetch(PING_URL, { signal: abort.signal, cache: 'no-store' })
        pings.push(Math.round(performance.now() - t0))
      }
      pings.sort((a, b) => a - b)
      const ping = pings[2]   // median of 5

      // ── 2. Download — stream directly from Cloudflare through Starlink ───
      setPhase('download')
      setLiveSpeed(0)

      const dlRes  = await fetch(DL_URL, { signal: abort.signal, cache: 'no-store' })
      const reader = dlRes.body.getReader()
      let dlBytes  = 0, dlStart = performance.now()
      let winStart = dlStart, winBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        dlBytes  += value.length
        winBytes += value.length
        const now = performance.now()
        if (now - winStart >= 250) {
          const liveMbps = (winBytes * 8) / ((now - winStart) / 1000 * 1_000_000)
          setLiveSpeed(liveMbps)
          winStart = now
          winBytes = 0
        }
      }
      const dlMbps = (dlBytes * 8) / ((performance.now() - dlStart) / 1000 * 1_000_000)

      // ── 3. Upload — XHR POST to Cloudflare, measures true upload speed ───
      setPhase('upload')
      setLiveSpeed(0)

      const ulMbps = await new Promise((resolve, reject) => {
        const xhr   = new XMLHttpRequest()
        xhrRef.current = xhr
        const start = performance.now()
        let prevT   = start, prevB = 0

        xhr.upload.onprogress = (e) => {
          const now = performance.now()
          const dt  = now - prevT
          if (dt >= 250) {
            const liveMbps = ((e.loaded - prevB) * 8) / (dt / 1000 * 1_000_000)
            setLiveSpeed(liveMbps)
            prevT = now
            prevB = e.loaded
          }
        }
        xhr.onload  = () => resolve((UPLOAD_BYTES * 8) / ((performance.now() - start) / 1000 * 1_000_000))
        xhr.onerror = () => reject(new Error('Upload failed — check internet connection'))
        xhr.onabort = () => reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }))
        abort.signal.addEventListener('abort', () => xhr.abort())

        xhr.open('POST', UL_URL)
        xhr.setRequestHeader('Content-Type', 'application/octet-stream')
        xhr.send(getUploadBuf())
      })

      setPhase('done')
      setResults({ ping, dlMbps, ulMbps })
      setLiveSpeed(null)

    } catch (e) {
      if (e.name === 'AbortError') { setPhase('idle'); return }
      setPhase('error')
      setErrMsg(e.message ?? 'Test failed')
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div>
          <span style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>
            Speed Test
          </span>
          <p style={{ fontSize: 10, color: 'var(--text-5)', marginTop: 2 }}>
            Tests against Cloudflare — traffic travels through this Starlink terminal
          </p>
        </div>
        {running
          ? <button onClick={cancel} className="rounded px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--bad)', background: 'var(--bad-bg)', border: '1px solid var(--bad-border)' }}>
              Cancel
            </button>
          : <button onClick={run} className="rounded px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
              style={{ color: 'var(--accent)', background: 'var(--accent-bg)', border: '1px solid var(--accent-border)' }}>
              {results ? 'Run Again' : 'Start Test'}
            </button>
        }
      </div>

      {/* Gauge + results side by side */}
      <div className="flex items-center" style={{ borderBottom: results ? '1px solid var(--border)' : 'none' }}>
        {/* Gauge */}
        <div className="flex items-center justify-center py-4 px-4" style={{ borderRight: '1px solid var(--border)' }}>
          <ArcGauge speed={liveSpeed} phase={phase} running={running || phase === 'done'} />
        </div>

        {/* Stats — always show, dim when no data */}
        <div className="flex flex-col flex-1 justify-center py-2">
          {phase === 'idle' && !results && (
            <p style={{ fontSize: 11, color: 'var(--text-5)', padding: '0 16px' }}>
              Press Start Test to measure download, upload &amp; latency
            </p>
          )}
          {phase === 'error' && (
            <p style={{ fontSize: 11, color: 'var(--bad)', padding: '0 16px' }}>{errMsg}</p>
          )}
          {results && (
            <>
              <ResultRow
                label="Download" unit="Mbps"
                value={fmtMbps(results.dlMbps)}
                color={speedColor(results.dlMbps)}
                sub={speedLabel(results.dlMbps)}
              />
              <ResultRow
                label="Upload" unit="Mbps"
                value={fmtMbps(results.ulMbps)}
                color={speedColor(results.ulMbps)}
                sub={speedLabel(results.ulMbps)}
                border
              />
              <ResultRow
                label="Latency" unit="ms"
                value={results.ping ?? '—'}
                color={pingColor(results.ping)}
                sub={pingLabel(results.ping)}
                border
              />
            </>
          )}
          {(running || (phase === 'done' && !results)) && (
            <p style={{ fontSize: 11, color: 'var(--text-5)', padding: '0 16px' }}>
              {phase === 'latency' ? 'Measuring round-trip time…' :
               phase === 'download' ? 'Downloading from Cloudflare…' :
               'Uploading to Cloudflare…'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
