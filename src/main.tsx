import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import App from './App'
import { applyClubColors } from './lib/clubColors'
import { db } from './lib/db'

async function boot() {
  let settings = await db.settings.get('app')
  if (!settings) {
    settings = { id: 'app', theme: 'auto' }
    await db.settings.put(settings)
  }

  // Theme-Einstellung anwenden (auto = OS-Präferenz, sonst erzwungen)
  if (settings && settings.theme !== 'auto') {
    document.documentElement.dataset.theme = settings.theme
  }
  // Vereinsfarben anwenden (fehlt = Standard-Blau/Gelb aus theme.css)
  applyClubColors(settings?.colors)

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
