import { useState, useEffect, useRef } from 'react'

const MAX_ENTRIES = 200
const STORAGE_KEY = 'sl-alert-log'

function loadLog() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

/**
 * Tracks alert state changes and builds a persistent history log.
 *
 * Each entry:
 *   id          — unique key (alert.key + startTime)
 *   key         — alert identifier
 *   label       — human-readable label
 *   startTime   — Unix ms when alert first appeared
 *   endTime     — Unix ms when resolved, null if still active
 */
export function useAlertLog(currentAlerts = []) {
  const [log, setLog] = useState(loadLog)   // lazy: loadLog() only on first render
  // Seed from stored open entries so a page reload doesn't re-create already-active alerts
  const prevKeysRef = useRef(null)
  if (prevKeysRef.current === null) {
    const stored = loadLog()
    prevKeysRef.current = new Set(stored.filter(e => e.endTime == null).map(e => e.key))
  }

  useEffect(() => {
    const now      = Date.now()
    const currKeys = new Set(currentAlerts.map(a => a.key))
    const prevKeys = prevKeysRef.current

    const newOnes     = currentAlerts.filter(a => !prevKeys.has(a.key))
    const resolvedKeys = [...prevKeys].filter(k => !currKeys.has(k))

    if (!newOnes.length && !resolvedKeys.length) {
      prevKeysRef.current = currKeys
      return
    }

    setLog(prev => {
      let next = [...prev]

      // Mark resolved
      if (resolvedKeys.length) {
        const resolvedSet = new Set(resolvedKeys)
        next = next.map(e =>
          e.endTime == null && resolvedSet.has(e.key)
            ? { ...e, endTime: now }
            : e
        )
      }

      // Add new entries (prepend so newest is first)
      for (const a of newOnes) {
        next = [{ id: `${a.key}-${now}`, key: a.key, label: a.label, startTime: now, endTime: null }, ...next]
      }

      return next.slice(0, MAX_ENTRIES)
    })

    prevKeysRef.current = currKeys
  }, [currentAlerts])

  // Persist on every log change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
  }, [log])

  const clearLog = () => {
    setLog([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return { log, clearLog }
}
