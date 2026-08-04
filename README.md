# Taktikboard

Eigenständiges Handball-Taktikboard, ausgekoppelt aus dem
[Handball Manager](https://github.com/derscharni/handballmanager).

Spielzüge auf dem Handballfeld aufbauen (Ganz-/Halbfeld, Abwehr ein-/
ausblenden, Trainingsmaterial), Laufwege per Drag aufzeichnen und
synchron animiert abspielen. Gespeicherte Züge bleiben lokal auf dem
Gerät (IndexedDB) und lassen sich über Tags ordnen.

Local-First-PWA — kein Backend, keine Anmeldung. Vereinsfarben sind aus
zwei Hex-Werten frei konfigurierbar (`src/lib/clubColors.ts`), Standard
ist Königsblau/Gelb.

## Entwicklung

```bash
npm install
npm run dev
```

## Tests & Build

```bash
npm test -- --run
npm run build
```

Deployment läuft automatisch bei jedem Push auf `main` via GitHub
Actions nach GitHub Pages.
