import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useLiveData }   from './hooks/useLiveData'
import { useAlertLog }   from './hooks/useAlertLog'
import { useOutageLog }  from './hooks/useOutageLog'
import { useSettings }   from './hooks/useSettings'
import Sidebar    from './components/Layout/Sidebar'
import Header     from './components/Layout/Header'
import NoDishPanel, { NoDishBanner } from './components/NoDishPanel'
import Dashboard   from './pages/Dashboard'
import Diagnostics from './pages/Diagnostics'
import Devices     from './pages/Devices'
import Alerts      from './pages/Alerts'
import Settings    from './pages/Settings'

export const LiveContext = createContext(null)
export const useLive     = () => useContext(LiveContext)

function MainContent() {
  const { data, dishConnected } = useContext(LiveContext)
  const location = useLocation()
  const onSettings = location.pathname === '/settings'

  // No data ever received and dish still unreachable → show full troubleshoot panel
  // (always allow Settings through so the user can change the dish address)
  if (!dishConnected && !data && !onSettings) {
    return <NoDishPanel />
  }

  return (
    <>
      {/* Slim banner when dish dropped mid-session */}
      {!dishConnected && data && <NoDishBanner />}

      <Routes>
        <Route path="/"            element={<Dashboard />}   />
        <Route path="/diagnostics" element={<Diagnostics />} />
        <Route path="/devices"     element={<Devices />}     />
        <Route path="/alerts"      element={<Alerts />}      />
        <Route path="/settings"    element={<Settings />}    />
      </Routes>
    </>
  )
}

function ReconnectToast({ visible }) {
  return (
    <div
      style={{
        position:   'fixed',
        bottom:     24,
        left:       '50%',
        transform:  `translateX(-50%) translateY(${visible ? 0 : 12}px)`,
        opacity:    visible ? 1 : 0,
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        pointerEvents: 'none',
        zIndex: 9999,
        background: '#0a3320',
        border: '1px solid #166534',
        borderRadius: 8,
        padding: '7px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0, boxShadow: '0 0 6px #22c55e' }} />
      <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 500 }}>Reconnected</span>
    </div>
  )
}

function Shell() {
  const live                                  = useLiveData()
  const { log: alertLog,  clearLog }          = useAlertLog(live.data?.alerts ?? [])
  const { log: outageLog, clearLog: clearOutageLog } = useOutageLog(live.dishConnected, live.data?.state)
  const { settings, update: updateSetting }   = useSettings()

  // Show a toast when the WS reconnects after having been disconnected
  const [showToast, setShowToast]  = useState(false)
  const prevConnected              = useRef(null)

  useEffect(() => {
    // Ignore the very first connection — only fire on reconnections
    if (prevConnected.current === false && live.connected === true) {
      setShowToast(true)
      const t = setTimeout(() => setShowToast(false), 3000)
      return () => clearTimeout(t)
    }
    prevConnected.current = live.connected
  }, [live.connected])

  const ctx = { ...live, alertLog, clearLog, outageLog, clearOutageLog, settings, updateSetting }

  return (
    <LiveContext.Provider value={ctx}>
      <div className="flex flex-col" style={{ height: '100dvh', background: '#0a0c10' }}>
        <Header
          wsConnected={live.connected}
          dishConnected={live.dishConnected}
          dishAddress={settings.dishAddress}
        />

        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-4">
            <MainContent />
          </main>
        </div>
      </div>

      <ReconnectToast visible={showToast} />
    </LiveContext.Provider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
