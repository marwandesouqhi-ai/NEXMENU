import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

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
