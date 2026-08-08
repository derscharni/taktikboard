import { Suspense, lazy } from 'react'

const TaktikScreen = lazy(() => import('./features/taktik/TaktikScreen'))

/**
 * Taktikboard — eigenständige App, ausgekoppelt aus dem Handball Manager.
 * Enthält bewusst nur das Taktikboard: Spielzüge aufbauen, Laufwege
 * aufzeichnen, abspielen, speichern. Kein Kader, kein Spielplan.
 */
export default function App() {
  return (
    // App-Frame: die Seite selbst scrollt nie — nur <main>. So bleibt die
    // Bedienung auf iOS/Android zuverlässig im Viewport (kein Wegscrollen
    // von Kopf-/Fußleisten durch Rubber-Band-Scrolling).
    <div className="mx-auto flex h-dvh max-w-lg flex-col lg:max-w-3xl">
      <header
        className="flex shrink-0 items-center gap-2.5 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]"
        style={{ background: 'var(--nav-grad)', borderBottom: '3px solid var(--club-acc)' }}
      >
        <div className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-club-acc font-display text-[13px] font-bold text-club-acc-ink">
          T
        </div>
        <h1 className="truncate font-display text-[16px] font-bold uppercase tracking-wide text-club-on">
          Taktikboard
        </h1>
      </header>

      <main
        id="app-scroll"
        className="flex-1 overflow-y-auto overscroll-contain px-3 pb-8 pt-2 lg:px-6"
      >
        <div className="mx-auto w-full">
          <Suspense
            fallback={
              <div className="flex h-[50dvh] items-center justify-center text-muted font-display uppercase tracking-wide">
                Lädt …
              </div>
            }
          >
            <TaktikScreen />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
