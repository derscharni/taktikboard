import { uid } from '../../lib/db'
import type {
  BoardMaterial,
  BoardToken,
  MaterialKind,
  StepPositions,
  TacticsBoard,
} from '../../lib/types'

/**
 * Taktikboard-Grunddaten: Feldmaße, Aufstellungen und ladbare Presets.
 *
 * Koordinaten sind normiert (0..1): x quer (20 m), y längs (40 m) —
 * das Feld steht hochkant, das Angriffs-Tor liegt oben (y = 0),
 * die Angriffshälfte ist y 0..0.5 (Halbfeld-Ansicht).
 *
 * Spielzüge sind Schrittfolgen: steps[0] ist die Grundstellung, jeder
 * weitere Schritt eine Ziel-Stellung — die Bewegung dazwischen ergänzt
 * die App beim Abspielen automatisch.
 */

export const FIELD_W = 20
export const FIELD_H = 40

export const MATERIAL_KINDS: MaterialKind[] = [
  'huetchen',
  'stange',
  'leiter',
  'matte',
  'minitor',
  'ball-extra',
]

export const MATERIAL_LABEL: Record<MaterialKind, string> = {
  huetchen: 'Hütchen',
  stange: 'Stange',
  leiter: 'Leiter',
  matte: 'Matte',
  minitor: 'Minitor',
  'ball-extra': 'Bälle',
}

export function tok(kind: BoardToken['kind'], label: string, x: number, y: number): BoardToken {
  return { id: uid(), kind, label: label || undefined, x, y }
}

export function mat(kind: MaterialKind, x: number, y: number): BoardMaterial {
  return { id: uid(), kind, x, y }
}

/** Grundstellung (Schritt 0) aus den aktuellen Figuren-Positionen. */
export function baseStep(tokens: BoardToken[]): StepPositions {
  const s: StepPositions = {}
  for (const t of tokens) s[t.id] = { x: t.x, y: t.y }
  return s
}

/** Folgeschritt: wie `prev`, mit gezielten Bewegungen einzelner Figuren. */
export function nextStep(
  prev: StepPositions,
  moves: [BoardToken, number, number][],
): StepPositions {
  const s: StepPositions = { ...prev }
  for (const [t, x, y] of moves) s[t.id] = { x, y }
  return s
}

/** Angriffs-Grundaufstellung (gegen das obere Tor). */
const ATTACK: [string, number, number][] = [
  ['TW', 0.5, 0.465],
  ['LA', 0.11, 0.11],
  ['RL', 0.28, 0.325],
  ['RM', 0.5, 0.37],
  ['RR', 0.72, 0.325],
  ['KM', 0.5, 0.18],
  ['RA', 0.89, 0.11],
]

/** 6:0-Abwehrpositionen vor dem oberen Tor (von links nach rechts). */
const DEF_SLOTS: [number, number][] = [
  [0.16, 0.13],
  [0.31, 0.175],
  [0.435, 0.195],
  [0.565, 0.195],
  [0.69, 0.175],
  [0.84, 0.13],
]

const GOAL_TOP: [number, number] = [0.5, 0.0325]

/** Eigene 7 in Angriffsformation; beim ganzen Feld steht die TW im eigenen (unteren) Tor. */
export function ownAttackTokens(field: 'full' | 'half'): BoardToken[] {
  return ATTACK.map(([label, x, y]) =>
    tok('own', label, x, label === 'TW' && field === 'full' ? 0.955 : y),
  )
}

/** Gegnerinnen 6+1 in 6:0-Formation vor dem oberen Tor. */
export function oppDefenseTokens(): BoardToken[] {
  const tokens = DEF_SLOTS.map(([x, y], i) => tok('opp', String(i + 1), x, y))
  tokens.push(tok('opp', 'T', GOAL_TOP[0], GOAL_TOP[1]))
  return tokens
}

export function ballToken(x = 0.45, y = 0.3975): BoardToken {
  return tok('ball', '', x, y)
}

/* ---------- Neuer Zug ---------- */

export type NewBoardKind = 'angriff' | 'abwehr' | 'leer'

export const NEW_BOARD_OPTIONS: { kind: NewBoardKind; title: string; sub: string }[] = [
  {
    kind: 'angriff',
    title: 'Angriff 3:2:1 — Grundaufstellung',
    sub: 'Eigene 7 in Angriffsformation, Ball bei RM',
  },
  {
    kind: 'abwehr',
    title: '6:0 Abwehr',
    sub: 'Eigene Abwehr vor dem Tor, Gegnerinnen im Angriff',
  },
  {
    kind: 'leer',
    title: 'Leeres Feld',
    sub: 'Nur der Ball — alles frei aufbauen',
  },
]

export function makeNewBoard(kind: NewBoardKind): TacticsBoard {
  const base = {
    id: uid(),
    field: 'half' as const,
    materials: [] as BoardMaterial[],
    updatedAt: new Date().toISOString(),
  }
  if (kind === 'angriff') {
    const tokens = [...ownAttackTokens('half'), ballToken()]
    return { ...base, title: 'Angriff 3:2:1', tokens, steps: [baseStep(tokens)] }
  }
  if (kind === 'abwehr') {
    const labels = ['LA', 'RL', 'KM', 'RM', 'RR', 'RA']
    const own = DEF_SLOTS.map(([x, y], i) => tok('own', labels[i], x, y))
    own.push(tok('own', 'TW', GOAL_TOP[0], GOAL_TOP[1]))
    const opp = ATTACK.filter(([label]) => label !== 'TW').map(([, x, y], i) =>
      tok('opp', String(i + 1), x, y),
    )
    const tokens = [...own, ...opp, ballToken(0.5, 0.39)]
    return { ...base, title: '6:0 Abwehr', tokens, steps: [baseStep(tokens)] }
  }
  const tokens = [ballToken(0.5, 0.3)]
  return { ...base, title: 'Neuer Spielzug', tokens, steps: [baseStep(tokens)] }
}

/* ---------- Presets ---------- */

export interface TaktikPreset {
  id: string
  /** Kurzer Chip-Text. */
  chip: string
  title: string
  /** Ein Satz Beschreibung. */
  description: string
  field: 'full' | 'half'
  build: () => Pick<TacticsBoard, 'tokens' | 'materials' | 'steps'>
}

export const PRESETS: TaktikPreset[] = [
  {
    id: 'kreuzung',
    chip: 'Kreuzung RM/RL',
    title: 'Kreuzung RM/RL mit Einläufer',
    description:
      'Schritt 1: Grundstellung. Schritt 2: RM und RL kreuzen, KM läuft an den Kreis, der Ball wandert per Pass auf RL.',
    field: 'half',
    build: () => {
      const own = ownAttackTokens('half')
      const find = (label: string) => own.find((t) => t.label === label)!
      const ball = ballToken()
      const tokens = [...own, ...oppDefenseTokens(), ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [find('RM'), 0.31, 0.2425],
        [find('RL'), 0.53, 0.245],
        [find('KM'), 0.33, 0.17],
        [ball, 0.52, 0.25],
      ])
      return { tokens, materials: [], steps: [s0, s1] }
    },
  },
  {
    id: 'anspiel-kreis',
    chip: 'Training: Anspiel Kreis',
    title: 'Training: Anspiel Kreis unter Druck',
    description:
      'Schritt 1: Aufbau. Schritt 2: KM löst sich am Kreis, RM spielt gegen den Druck an — die Hütchen markieren die Druckzonen.',
    field: 'half',
    build: () => {
      const rm = tok('own', 'RM', 0.5, 0.385)
      const km = tok('own', 'KM', 0.37, 0.235)
      const rl = tok('own', 'RL', 0.35, 0.26)
      const rr = tok('own', 'RR', 0.66, 0.26)
      const ball = ballToken(0.47, 0.3675)
      const tokens = [rm, km, rl, rr, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [rm, 0.48, 0.305],
        [km, 0.56, 0.17],
        [ball, 0.52, 0.185],
      ])
      return {
        tokens,
        materials: [
          mat('huetchen', 0.31, 0.285),
          mat('huetchen', 0.69, 0.285),
          mat('huetchen', 0.35, 0.36),
          mat('huetchen', 0.65, 0.36),
          mat('ball-extra', 0.88, 0.46),
        ],
        steps: [s0, s1],
      }
    },
  },
]

/** Preset als eigenständiges Board (für die Erst-Befüllung). */
export function buildPresetBoard(preset: TaktikPreset): TacticsBoard {
  const built = preset.build()
  return {
    id: uid(),
    title: preset.title,
    field: preset.field,
    tokens: built.tokens,
    materials: built.materials,
    steps: built.steps,
    updatedAt: new Date().toISOString(),
  }
}
