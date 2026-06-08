import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { hydrateFromServer } from './data/importBatches'

const root = createRoot(document.getElementById('root')!)

// Démarrage : on récupère d'abord les données depuis la BASE EN LIGNE (si
// disponible), PUIS on charge l'app. Ainsi le dashboard lit directement les
// données partagées entre tous les appareils. Si la base est injoignable, on
// bascule automatiquement sur le stockage local (le site fonctionne quand même).
async function boot() {
  try {
    await hydrateFromServer()
  } catch {
    /* base indisponible → on continue en local */
  }
  const { default: App } = await import('./App.tsx')
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

boot()
