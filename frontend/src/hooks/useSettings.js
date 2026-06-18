import { useState, useCallback } from 'react'

export const DEFAULTS = {
  dishAddress:   '192.168.100.1:9200',
  pollIntervalS: 5,       // seconds between REST diagnostic/device polls
  tempUnit:      'C',     // 'C' | 'F'
  theme:         'dark',  // 'dark' | 'light'
}

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('sl-settings') ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load)

  const update = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value }
      localStorage.setItem('sl-settings', JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, update }
}
