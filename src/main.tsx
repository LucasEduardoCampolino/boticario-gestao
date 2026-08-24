// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom' // ← Mudar para HashRouter
import App from './App'
import './index.css'

// Registrar Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registrado:', registration.scope)
      })
      .catch((error) => {
        console.error('Erro ao registrar Service Worker:', error)
      })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>  {/* ← Mudar para HashRouter */}
      <App />
    </HashRouter>
  </StrictMode>,
)