import { useState, useEffect, useRef, useCallback } from 'react'

const HISTORY_MAX = 900
const WS_URL = `ws://${window.location.host}/ws/live`

/**
 * Connects to /ws/live and maintains:
 *   data       — latest snapshot object
 *   history    — rolling array of up to 900 snapshots
 *   connected  — boolean
 *   error      — last error string or null
 */
export function useLiveData() {
  const [data, setData]               = useState(null)
  const [history, setHistory]         = useState([])
  const [connected, setConnected]     = useState(false)
  const [dishConnected, setDishConn]  = useState(false)
  const [error, setError]             = useState(null)
  const wsRef      = useRef(null)
  const timerRef   = useRef(null)
  const retriesRef = useRef(0)   // tracks reconnect attempts; survives WS object replacement

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      retriesRef.current = 0   // successful connection — reset backoff
      setConnected(true)
      setError(null)
    }

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        // ignore keepalive pings
        if (msg.type === 'ping') return
        // every message carries dish_connected; error frames only have that field
        if (msg.dish_connected === false) {
          setDishConn(false)
          return
        }
        setDishConn(true)
        setData(msg)
        setHistory(prev => {
          const next = [...prev, msg]
          return next.length > HISTORY_MAX ? next.slice(next.length - HISTORY_MAX) : next
        })
      } catch {
        // malformed frame — ignore
      }
    }

    ws.onerror = () => {
      setError('WebSocket error')
    }

    ws.onclose = () => {
      setConnected(false)
      setDishConn(false)
      // exponential backoff reconnect, capped at 10s
      const delay = Math.min(1000 * (2 ** Math.min(retriesRef.current, 4)), 10_000)
      retriesRef.current++
      timerRef.current = setTimeout(connect, delay)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(timerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { data, history, connected, dishConnected, error }
}
