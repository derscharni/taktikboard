/**
 * Domänen-Typen des Taktikboards.
 *
 * Grundsätze:
 * - Datums-/Zeitwerte als ISO-Strings (YYYY-MM-DD bzw. ISO 8601) — IndexedDB-freundlich.
 * - IDs sind UUIDs (crypto.randomUUID()).
 */

/* ---------- Taktikboard ---------- */

export type TokenKind = 'own' | 'opp' | 'ball'
export type MaterialKind =
  | 'huetchen'
  | 'stange'
  | 'leiter'
  | 'matte'
  | 'minitor'
  | 'ball-extra'

export interface BoardToken {
  id: string
  kind: TokenKind
  /** Beschriftung, z.B. Positions-Kürzel oder Spielerinnen-Initialen. */
  label?: string
  playerId?: string
  /** Normierte Koordinaten 0..1 (x quer, y längs des Feldes). */
  x: number
  y: number
  /** Aufgezeichneter Laufweg als normierte Punktfolge. */
  path?: { x: number; y: number }[]
}

export interface BoardMaterial {
  id: string
  kind: MaterialKind
  x: number
  y: number
}

export interface TacticsBoard {
  id: string
  title: string
  field: 'full' | 'half'
  tokens: BoardToken[]
  materials: BoardMaterial[]
  /** Freie Tags zum Ordnen der Züge/Übungen (z.B. "Angriff", "Warmup"). */
  tags?: string[]
  updatedAt: string
}

/* ---------- Einstellungen ---------- */

export interface Settings {
  /** Fester Key 'app' — genau ein Datensatz. */
  id: string
  theme: 'auto' | 'light' | 'dark'
  /** Vereinsfarben (Hex): Hauptfarbe + Akzent. Fehlt = Standard-Blau/Gelb. */
  colors?: { primary: string; accent: string }
}
