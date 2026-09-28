import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Fetch a REST endpoint and optionally re-poll on an interval.
 *
 * @param {string} url           - e.g. '/api/status'
 * @param {number} intervalMs    - 0 = fetch once, >0 = re-poll
 *
 * Improvements over the original:
 *  - AbortController cancels any in-flight fetch on unmount or url change
 *  - Polling pauses when the tab is hidden (Page Visibility API) and
 *    immediately re-fetches when it becomes visible again
 */
export function useApi(url, intervalMs = 0) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const abortRef = useRef(null)

  const fetchData = useCallback(async () => {
    // Cancel any previous in-flight request
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    fetchData()

    if (!intervalMs) return

    let timerId = null

    function schedule() {
      timerId = setInterval(() => {
        if (!document.hidden) fetchData()
      }, intervalMs)
    }

    function onVisibility() {
      if (!document.hidden) {
        // Tab became visible — fetch immediately then restart interval
        clearInterval(timerId)
        fetchData()
        schedule()
      }
    }

    schedule()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(timerId)
      document.removeEventListener('visibilitychange', onVisibility)
      abortRef.current?.abort()
    }
  }, [fetchData, intervalMs])

  return { data, loading, error, refetch: fetchData }
}
