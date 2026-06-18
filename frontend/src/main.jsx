import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Apply saved theme before first render to avoid flash
try {
  const saved = JSON.parse(localStorage.getItem('sl-settings') ?? '{}')
  if (saved.theme === 'light') document.documentElement.classList.add('theme-light')
} catch {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
