import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
const entry = import.meta.env.MODE === 'guest' ? import('./GuestStudio') : import('./App')
entry.then(({ default: App }) => {
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
})
