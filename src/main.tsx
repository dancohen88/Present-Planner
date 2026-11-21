import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applySkin, savedSkin } from './skins.ts'

// index.html has already set data-skin; this also tints the status bar.
applySkin(savedSkin())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
