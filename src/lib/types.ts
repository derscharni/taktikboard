/**
 * Domänen-Typen des Taktikboards.
 *
 * Grundsätze:
 * - Datums-/Zeitwerte als ISO-Strings — IndexedDB-freundlich.
 * - IDs sind UUIDs (crypto.randomUUID()).
 * - Koordinaten sind normiert (0..1): x quer, y längs des Feldes.
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
  /** Beschriftung, z.B. Positions-Kürzel oder Nummer. */
  label?: string
  /** Aktuelle Anzeige-Position (entspricht dem gewählten Schritt). */
  x: number
  y: number
  /**
   * Veraltet (frei aufgezeichneter Laufweg aus der ersten Version).
   * Wird beim Laden in Schritte überführt und nicht mehr geschrieben.
   */
  path?: { x: number; y: number }[]
}

export interface BoardMaterial {
  id: string
  kind: MaterialKind
  x: number
  y: number
}

/** Positionen aller Figuren in einem Schritt (tokenId → Punkt). */
export type StepPositions = Record<string, { x: number; y: number }>

export interface TacticsBoard {
  id: string
  title: string
  field: 'full' | 'half'
  tokens: BoardToken[]
  materials: BoardMaterial[]
  /**
   * Spielzug als Schrittfolge: steps[0] ist die Grundstellung, jeder
   * weitere Schritt eine Ziel-Stellung. Die Bewegung dazwischen wird
   * beim Abspielen automatisch interpoliert.
   */
  steps: StepPositions[]
  /** Freie Tags zum Ordnen der Züge/Übungen (z.B. "Angriff", "Warmup"). */
  tags?: string[]
  updatedAt: string
}

/* ---------- Einstellungen ---------- */

/** Farbschema des Spielfelds — frei wählbar. */
export interface FieldColors {
  /** Spielfläche. */
  court: string
  /** Torraum (6-m-Zone). */
  area: string
  /** Linien. */
  lines: string
}

export const DEFAULT_FIELD_COLORS: FieldColors = {
  court: '#2f6bc4',
  area: '#1d4a94',
  lines: '#f5f8ff',
}

export const FIELD_COLOR_PRESETS: { id: string; label: string; colors: FieldColors }[] = [
  { id: 'blau', label: 'Blau', colors: DEFAULT_FIELD_COLORS },
  {
    id: 'parkett',
    label: 'Parkett',
    colors: { court: '#d9a866', area: '#3f7fbf', lines: '#ffffff' },
  },
  {
    id: 'orange',
    label: 'Orange',
    colors: { court: '#e8862e', area: '#20649e', lines: '#ffffff' },
  },
  {
    id: 'gruen',
    label: 'Grün',
    colors: { court: '#3d8f5f', area: '#2a5e93', lines: '#ffffff' },
  },
]

export interface Settings {
  /** Fester Key 'app' — genau ein Datensatz. */
  id: string
  theme: 'auto' | 'light' | 'dark'
  /** Vereinsfarben (Hex): Hauptfarbe + Akzent. Fehlt = Standard-Blau/Gelb. */
  colors?: { primary: string; accent: string }
  /** Feld-Farbschema. Fehlt = DEFAULT_FIELD_COLORS. */
  fieldColors?: FieldColors
}
