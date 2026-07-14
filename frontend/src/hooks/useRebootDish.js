import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Shared reboot-dish action + status state machine.
 * state: null | 'busy' | 'ok' | 'err' — 'err' auto-clears after 4s.
 */
export function useRebootDish() {
  const [state, setState] = useState(null)
  const clearTimer = useRef(null)

  useEffect(() => () => clearTimeout(clearTimer.current), [])

  const reboot = useCallback(async () => {
    setState('busy')
    try {
      const r = await fetch('/api/control/reboot', { method: 'POST' })
      if (!r.ok) throw new Error()
      setState('ok')
    } catch {
      setState('err')
      clearTimer.current = setTimeout(() => setState(null), 4000)
    }
  }, [])

  return { state, reboot }
}
