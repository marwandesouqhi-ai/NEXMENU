import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = () =>
    '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (
        Number(c) ^
        ((typeof crypto.getRandomValues === 'function'
          ? crypto.getRandomValues(new Uint8Array(1))[0]
          : Math.floor(Math.random() * 256)) &
          (15 >> (Number(c) / 4)))
      ).toString(16),
    ) as `${string}-${string}-${string}-${string}-${string}`
}

registerSW({
  onNeedRefresh() {
    if (window.confirm('A new version of NEXMENU is ready. Update now?')) window.location.reload()
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
