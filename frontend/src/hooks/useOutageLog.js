import { useState, useEffect, useRef } from 'react'

const MAX_ENTRIES = 100
const STORAGE_KEY = 'sl-outage-log'

function loadLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

/**
 * Tracks dish connectivity transitions and builds a persistent outage log.
 *
 * Each entry:
 *   id        — unique string
 *   startTime — Unix ms when dish went offline
 *   endTime   — Unix ms when restored, null if still down
 *   cause     — dish state string at the time of the outage (e.g. "SEARCHING")
 */
export function useOutageLog(dishConnected, state) {
  const [log, setLog]      = useState(loadLog)
  const prevConnRef        = useRef(null)   // null = unknown (before first WS message)

  useEffect(() => {
    // Skip the very first value — we don't know if it's a transition yet
    if (prevConnRef.current === null) {
      prevConnRef.current = dishConnected
      return
    }
    if (prevConnRef.current === dishConnected) return

    const now = Date.now()

    if (!dishConnected) {
      // Dish just went down
      setLog(prev => [{
        id:        `outage-${now}`,
        startTime: now,
        endTime:   null,
        cause:     state ?? 'UNKNOWN',
      }, ...prev].slice(0, MAX_ENTRIES))
    } else {
      // Dish came back — close the latest open entry
      setLog(prev => {
        const idx = prev.findIndex(e => e.endTime == null)
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = { ...next[idx], endTime: now }
        return next
      })
    }

    prevConnRef.current = dishConnected
  }, [dishConnected, state])

  // Persist every time log changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  }, [log])

  const clearLog = () => {
    setLog([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return { log, clearLog }
}
