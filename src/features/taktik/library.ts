import { uid } from '../../lib/db'
import type { StepPositions, TacticsBoard } from '../../lib/types'
import {
  ballToken,
  baseStep,
  mat,
  nextStep,
  oppDefenseTokens,
  ownAttackTokens,
  tok,
} from './presets'

/**
 * Formations- und Übungsbibliothek: kuratierte Aufstellungen, Auslösungen,
 * Tempospiel, Standards und Trainingsübungen — jeweils als Schrittfolge,
 * fertig zum Laden und frei anpassbar. Rechts-/Links-Varianten entstehen
 * durch Spiegelung, damit beide Seiten abgedeckt sind.
 */

export const LIBRARY_CATEGORIES = [
  'Abwehr',
  'Angriff',
  'Auslösungen',
  'Tempospiel',
  'Standards',
  'Training',
] as const
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number]

export interface LibraryEntry {
  id: string
  kategorie: LibraryCategory
  title: string
  description: string
  field: 'full' | 'half'
  build: () => Pick<TacticsBoard, 'tokens' | 'materials' | 'steps'>
}

/* ---------- Spiegelung (Rechts-/Links-Variante) ---------- */

const LABEL_SWAP: Record<string, string> = { LA: 'RA', RA: 'LA', RL: 'RR', RR: 'RL' }

function mirrored(
  entry: LibraryEntry,
  id: string,
  title: string,
  description?: string,
): LibraryEntry {
  return {
    ...entry,
    id,
    title,
    description: description ?? entry.description,
    build: () => {
      const b = entry.build()
      return {
        tokens: b.tokens.map((t) => ({
          ...t,
          label: t.label && LABEL_SWAP[t.label] ? LABEL_SWAP[t.label] : t.label,
          x: 1 - t.x,
        })),
        materials: b.materials.map((m) => ({ ...m, x: 1 - m.x })),
        steps: b.steps.map((s) => {
          const out: StepPositions = {}
          for (const [tid, p] of Object.entries(s)) out[tid] = { x: 1 - p.x, y: p.y }
          return out
        }),
      }
    },
  }
}

/* ---------- Bausteine ---------- */

/** Eigene 7 als Abwehr in freien Positionen (Reihenfolge LA RL KM RM RR RA + TW). */
function ownDefense(slots: [number, number][]): ReturnType<typeof tok>[] {
  const labels = ['LA', 'RL', 'KM', 'RM', 'RR', 'RA']
  const own = slots.map(([x, y], i) => tok('own', labels[i] ?? `S${i + 1}`, x, y))
  own.push(tok('own', 'TW', 0.5, 0.0325))
  return own
}

/** Gegnerinnen im 3:3-Angriff (nummeriert) + Ball bei der Spielmacherin. */
function oppAttack(): { tokens: ReturnType<typeof tok>[]; ball: ReturnType<typeof ballToken> } {
  const coords: [number, number][] = [
    [0.11, 0.11],
    [0.28, 0.325],
    [0.5, 0.37],
    [0.72, 0.325],
    [0.5, 0.18],
    [0.89, 0.11],
  ]
  return {
    tokens: coords.map(([x, y], i) => tok('opp', String(i + 1), x, y)),
    ball: ballToken(0.5, 0.39),
  }
}

function formation(tokens: ReturnType<typeof tok>[]): Pick<TacticsBoard, 'tokens' | 'materials' | 'steps'> {
  return { tokens, materials: [], steps: [baseStep(tokens)] }
}

/* ---------- Abwehr ---------- */

function defenseEntry(
  id: string,
  title: string,
  description: string,
  slots: [number, number][],
): LibraryEntry {
  return {
    id,
    kategorie: 'Abwehr',
    title,
    description,
    field: 'half',
    build: () => {
      const own = ownDefense(slots)
      const opp = oppAttack()
      return formation([...own, ...opp.tokens, opp.ball])
    },
  }
}

const ABWEHR: LibraryEntry[] = [
  defenseEntry(
    'abwehr-60',
    '6:0 — Flach',
    'Alle sechs am Kreis, Block gegen den Rückraum. Stabil gegen Kreis und Durchbrüche, anfällig für Distanzwürfe.',
    [
      [0.16, 0.13],
      [0.31, 0.175],
      [0.435, 0.195],
      [0.565, 0.195],
      [0.69, 0.175],
      [0.84, 0.13],
    ],
  ),
  defenseEntry(
    'abwehr-51',
    '5:1 — Mit Spitze',
    'Fünf flach, eine Spitze stört den Aufbau der Spielmacherin und erschwert Auslösungen über die Mitte.',
    [
      [0.18, 0.14],
      [0.34, 0.175],
      [0.5, 0.185],
      [0.66, 0.175],
      [0.82, 0.14],
      [0.5, 0.285],
    ],
  ),
  defenseEntry(
    'abwehr-321',
    '3:2:1 — Offensiv',
    'Drei Linien, hoher Druck auf den Ballführenden. Zwingt den Angriff früh in Entscheidungen — laufintensiv.',
    [
      [0.32, 0.15],
      [0.5, 0.155],
      [0.68, 0.15],
      [0.38, 0.235],
      [0.62, 0.235],
      [0.5, 0.315],
    ],
  ),
  defenseEntry(
    'abwehr-42',
    '4:2 — Doppelspitze',
    'Vier flach, zwei vorgezogen gegen wurfstarken Rückraum. Halbpositionen werden früh attackiert.',
    [
      [0.26, 0.155],
      [0.42, 0.18],
      [0.58, 0.18],
      [0.74, 0.155],
      [0.4, 0.27],
      [0.6, 0.27],
    ],
  ),
  defenseEntry(
    'abwehr-33',
    '3:3 — Sehr offensiv',
    'Zwei komplette Linien — nimmt dem Rückraum Zeit und Raum, öffnet aber Lücken am Kreis. Gut bei Rückstand.',
    [
      [0.3, 0.155],
      [0.5, 0.16],
      [0.7, 0.155],
      [0.32, 0.27],
      [0.5, 0.285],
      [0.68, 0.27],
    ],
  ),
  {
    id: 'abwehr-mann',
    kategorie: 'Abwehr',
    title: 'Offensive Manndeckung',
    description:
      'Jede Angreiferin bekommt eine direkte Gegenspielerin — für die Schlussphase oder gegen eine überragende Einzelspielerin.',
    field: 'half',
    build: () => {
      const opp = oppAttack()
      const own = opp.tokens.map((t, i) =>
        tok('own', ['LA', 'RL', 'RM', 'RR', 'KM', 'RA'][i] ?? `S${i}`, Math.min(0.94, t.x + 0.02), t.y + 0.045),
      )
      own.push(tok('own', 'TW', 0.5, 0.0325))
      return formation([...own, ...opp.tokens, opp.ball])
    },
  },
]

/* ---------- Angriff ---------- */

const ANGRIFF: LibraryEntry[] = [
  {
    id: 'angriff-33',
    kategorie: 'Angriff',
    title: '3:3 — Grundstellung',
    description:
      'Klassischer Positionsangriff: drei Rückraum, zwei Außen, eine Kreisläuferin. Ausgangspunkt fast aller Auslösungen.',
    field: 'half',
    build: () => formation([...ownAttackTokens('half'), ballToken()]),
  },
  {
    id: 'angriff-24',
    kategorie: 'Angriff',
    title: '2:4 — Doppelkreis',
    description:
      'Zweite Kreisläuferin bindet die Abwehr am Kreis — stark gegen 6:0, braucht sichere Rückraum-Pässe.',
    field: 'half',
    build: () => {
      const tokens = [
        tok('own', 'TW', 0.5, 0.465),
        tok('own', 'LA', 0.11, 0.11),
        tok('own', 'RA', 0.89, 0.11),
        tok('own', 'KM', 0.4, 0.17),
        tok('own', 'K2', 0.62, 0.17),
        tok('own', 'RL', 0.32, 0.34),
        tok('own', 'RR', 0.68, 0.34),
        ballToken(0.34, 0.36),
      ]
      return formation(tokens)
    },
  },
  {
    id: 'angriff-7g6',
    kategorie: 'Angriff',
    title: '7 gegen 6 — Überzahl',
    description:
      'Siebte Feldspielerin statt Torhüterin: Überzahl im Positionsangriff. Vorsicht — leeres eigenes Tor.',
    field: 'half',
    build: () => {
      const own = ownAttackTokens('half').filter((t) => t.label !== 'TW')
      own.push(tok('own', 'K2', 0.62, 0.17))
      return formation([...own, ballToken()])
    },
  },
  {
    id: 'angriff-breit',
    kategorie: 'Angriff',
    title: '3:3 — Breit gegen 5:1',
    description:
      'Außen ganz in den Ecken, Halbpositionen weit — zieht die 5:1 auseinander und öffnet die Nahtstellen neben der Spitze.',
    field: 'half',
    build: () =>
      formation([
        tok('own', 'TW', 0.5, 0.465),
        tok('own', 'LA', 0.06, 0.085),
        tok('own', 'RL', 0.2, 0.33),
        tok('own', 'RM', 0.5, 0.385),
        tok('own', 'RR', 0.8, 0.33),
        tok('own', 'KM', 0.5, 0.175),
        tok('own', 'RA', 0.94, 0.085),
        ballToken(0.45, 0.4),
      ]),
  },
]

/* ---------- Auslösungen (mehrschrittig) ---------- */

function attackBase() {
  const own = ownAttackTokens('half')
  const find = (label: string) => own.find((t) => t.label === label)!
  const ball = ballToken()
  const tokens = [...own, ...oppDefenseTokens(), ball]
  return { own, find, ball, tokens, s0: baseStep(tokens) }
}

const kreuzungRl: LibraryEntry = {
  id: 'ausl-kreuzung-rl',
  kategorie: 'Auslösungen',
  title: 'Kreuzung RM/RL',
  description:
    'RM kreuzt mit RL, KM läuft als Einläuferin an den Kreis — Ball wandert per Pass auf die durchbrechende RL.',
  field: 'half',
  build: () => {
    const { find, ball, tokens, s0 } = attackBase()
    const s1 = nextStep(s0, [
      [find('RM'), 0.31, 0.2425],
      [find('RL'), 0.53, 0.245],
      [find('KM'), 0.33, 0.17],
      [ball, 0.52, 0.25],
    ])
    return { tokens, materials: [], steps: [s0, s1] }
  },
}

const einlaeuferLa: LibraryEntry = {
  id: 'ausl-einlaeufer-la',
  kategorie: 'Auslösungen',
  title: 'Einläuferin LA',
  description:
    'Linksaußen läuft an den Kreis (Übergang zu 2:4), RL rückt auf die freie Außenbahn nach — Ball kommt hinterher.',
  field: 'half',
  build: () => {
    const { find, ball, tokens, s0 } = attackBase()
    const s1 = nextStep(s0, [
      [find('LA'), 0.3, 0.155],
      [find('RL'), 0.17, 0.28],
    ])
    const s2 = nextStep(s1, [
      [find('RL'), 0.13, 0.2],
      [ball, 0.16, 0.22],
    ])
    return { tokens, materials: [], steps: [s0, s1, s2] }
  },
}

const sperreRl: LibraryEntry = {
  id: 'ausl-sperre-rl',
  kategorie: 'Auslösungen',
  title: 'Sperre/Absetzen für RL',
  description:
    'KM stellt die Sperre an der Halbverteidigerin, RL zieht in die Lücke — KM setzt sich zum Anspiel ab.',
  field: 'half',
  build: () => {
    const { find, ball, tokens, s0 } = attackBase()
    const s1 = nextStep(s0, [
      [find('KM'), 0.34, 0.195],
      [find('RL'), 0.38, 0.25],
      [ball, 0.37, 0.27],
    ])
    const s2 = nextStep(s1, [
      [find('RL'), 0.35, 0.165],
      [find('KM'), 0.46, 0.155],
      [ball, 0.36, 0.18],
    ])
    return { tokens, materials: [], steps: [s0, s1, s2] }
  },
}

const parallelstoss: LibraryEntry = {
  id: 'ausl-parallelstoss',
  kategorie: 'Auslösungen',
  title: 'Parallelstoß von links',
  description:
    'Der komplette Rückraum stößt parallel — der Ball läuft von RL über RM auf RR, die in die Nahtstelle geht.',
  field: 'half',
  build: () => {
    const { find, ball, tokens, s0 } = attackBase()
    const s1 = nextStep(s0, [
      [find('RL'), 0.26, 0.28],
      [find('RM'), 0.47, 0.31],
      [find('RR'), 0.7, 0.28],
      [ball, 0.28, 0.3],
    ])
    const s2 = nextStep(s1, [
      [find('RR'), 0.74, 0.215],
      [ball, 0.72, 0.235],
    ])
    return { tokens, materials: [], steps: [s0, s1, s2] }
  },
}

const doppelkreuz: LibraryEntry = {
  id: 'ausl-doppelkreuz',
  kategorie: 'Auslösungen',
  title: 'Doppelkreuz RM/RL/RR',
  description:
    'RM kreuzt zuerst mit RL, die sofort weiter mit RR kreuzt — zwei Tempowechsel hintereinander sprengen die Zuordnung.',
  field: 'half',
  build: () => {
    const { find, ball, tokens, s0 } = attackBase()
    const s1 = nextStep(s0, [
      [find('RM'), 0.33, 0.26],
      [find('RL'), 0.52, 0.295],
      [ball, 0.5, 0.31],
    ])
    const s2 = nextStep(s1, [
      [find('RL'), 0.7, 0.245],
      [find('RR'), 0.55, 0.265],
      [ball, 0.57, 0.28],
    ])
    return { tokens, materials: [], steps: [s0, s1, s2] }
  },
}

const wechselLa: LibraryEntry = {
  id: 'ausl-wechsel-la',
  kategorie: 'Auslösungen',
  title: 'Wechsel LA/KM',
  description:
    'Linksaußen läuft ein, die Kreisläuferin löst nach außen auf — die Abwehr muss übergeben oder es entsteht die Lücke.',
  field: 'half',
  build: () => {
    const { find, tokens, s0 } = attackBase()
    const s1 = nextStep(s0, [
      [find('LA'), 0.32, 0.16],
      [find('KM'), 0.12, 0.115],
    ])
    return { tokens, materials: [], steps: [s0, s1] }
  },
}

const AUSLOESUNGEN: LibraryEntry[] = [
  kreuzungRl,
  mirrored(kreuzungRl, 'ausl-kreuzung-rr', 'Kreuzung RM/RR', 'RM kreuzt mit RR, KM läuft als Einläuferin an den Kreis — Ball wandert per Pass auf die durchbrechende RR.'),
  doppelkreuz,
  einlaeuferLa,
  mirrored(einlaeuferLa, 'ausl-einlaeufer-ra', 'Einläuferin RA', 'Rechtsaußen läuft an den Kreis (Übergang zu 2:4), RR rückt auf die freie Außenbahn nach — Ball kommt hinterher.'),
  sperreRl,
  mirrored(sperreRl, 'ausl-sperre-rr', 'Sperre/Absetzen für RR', 'KM stellt die Sperre an der Halbverteidigerin, RR zieht in die Lücke — KM setzt sich zum Anspiel ab.'),
  parallelstoss,
  mirrored(parallelstoss, 'ausl-parallelstoss-r', 'Parallelstoß von rechts', 'Der komplette Rückraum stößt parallel — der Ball läuft von RR über RM auf RL, die in die Nahtstelle geht.'),
  wechselLa,
  mirrored(wechselLa, 'ausl-wechsel-ra', 'Wechsel RA/KM', 'Rechtsaußen läuft ein, die Kreisläuferin löst nach außen auf — die Abwehr muss übergeben oder es entsteht die Lücke.'),
]

/* ---------- Tempospiel (ganzes Feld) ---------- */

const TEMPOSPIEL: LibraryEntry[] = [
  {
    id: 'tempo-welle1',
    kategorie: 'Tempospiel',
    title: '1. Welle — Außen sprinten',
    description:
      'Nach Ballgewinn sprinten beide Außen sofort die Linie entlang, die Torhüterin bringt den langen Abwurf auf LA.',
    field: 'full',
    build: () => {
      const tw = tok('own', 'TW', 0.5, 0.955)
      const la = tok('own', 'LA', 0.08, 0.72)
      const ra = tok('own', 'RA', 0.92, 0.72)
      const rl = tok('own', 'RL', 0.3, 0.8)
      const rm = tok('own', 'RM', 0.5, 0.82)
      const rr = tok('own', 'RR', 0.7, 0.8)
      const km = tok('own', 'KM', 0.5, 0.74)
      const ball = ballToken(0.52, 0.94)
      const tokens = [tw, la, ra, rl, rm, rr, km, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [la, 0.07, 0.4],
        [ra, 0.93, 0.4],
        [km, 0.5, 0.55],
      ])
      const s2 = nextStep(s1, [
        [la, 0.12, 0.13],
        [ra, 0.88, 0.13],
        [ball, 0.11, 0.16],
        [rl, 0.3, 0.5],
        [rm, 0.5, 0.52],
        [rr, 0.7, 0.5],
      ])
      return { tokens, materials: [], steps: [s0, s1, s2] }
    },
  },
  {
    id: 'tempo-welle2',
    kategorie: 'Tempospiel',
    title: '2. Welle — Rückraum rückt nach',
    description:
      'Die erste Welle ist zugestellt: der nachrückende Rückraum übernimmt im Tempo, bevor die Abwehr sortiert ist.',
    field: 'full',
    build: () => {
      const tw = tok('own', 'TW', 0.5, 0.955)
      const la = tok('own', 'LA', 0.1, 0.2)
      const ra = tok('own', 'RA', 0.9, 0.2)
      const rl = tok('own', 'RL', 0.28, 0.6)
      const rm = tok('own', 'RM', 0.5, 0.62)
      const rr = tok('own', 'RR', 0.72, 0.6)
      const km = tok('own', 'KM', 0.5, 0.45)
      const ball = ballToken(0.31, 0.58)
      const tokens = [tw, la, ra, rl, rm, rr, km, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [rl, 0.25, 0.31],
        [rm, 0.48, 0.33],
        [rr, 0.72, 0.31],
        [km, 0.5, 0.18],
        [ball, 0.47, 0.35],
      ])
      const s2 = nextStep(s1, [
        [rm, 0.5, 0.25],
        [ball, 0.51, 0.24],
      ])
      return { tokens, materials: [], steps: [s0, s1, s2] }
    },
  },
  {
    id: 'tempo-schnelle-mitte',
    kategorie: 'Tempospiel',
    title: 'Schnelle Mitte',
    description:
      'Direkt nach dem Gegentor: RM führt sofort am Anwurfpunkt aus, alle anderen sind schon im Vorwärtsgang.',
    field: 'full',
    build: () => {
      const tw = tok('own', 'TW', 0.5, 0.955)
      const rm = tok('own', 'RM', 0.5, 0.515)
      const rl = tok('own', 'RL', 0.35, 0.56)
      const rr = tok('own', 'RR', 0.65, 0.56)
      const la = tok('own', 'LA', 0.1, 0.52)
      const ra = tok('own', 'RA', 0.9, 0.52)
      const km = tok('own', 'KM', 0.42, 0.47)
      const ball = ballToken(0.51, 0.51)
      const tokens = [tw, rm, rl, rr, la, ra, km, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [la, 0.08, 0.22],
        [ra, 0.92, 0.22],
        [rl, 0.3, 0.32],
        [rr, 0.7, 0.32],
        [km, 0.5, 0.2],
        [rm, 0.5, 0.36],
        [ball, 0.31, 0.34],
      ])
      return { tokens, materials: [], steps: [s0, s1] }
    },
  },
]

/* ---------- Standards ---------- */

const STANDARDS: LibraryEntry[] = [
  {
    id: 'std-7m',
    kategorie: 'Standards',
    title: '7-Meter',
    description:
      'Werferin allein am Strich, alle anderen hinter der Freiwurflinie — Nachschuss-Positionen für den Abpraller besetzen.',
    field: 'half',
    build: () =>
      formation([
        tok('own', 'W', 0.5, 0.19),
        tok('own', 'LA', 0.14, 0.29),
        tok('own', 'RL', 0.34, 0.315),
        tok('own', 'RR', 0.66, 0.315),
        tok('own', 'RA', 0.86, 0.29),
        tok('own', 'KM', 0.5, 0.33),
        tok('opp', 'T', 0.5, 0.0325),
        ballToken(0.5, 0.2),
      ]),
  },
  {
    id: 'std-freiwurf',
    kategorie: 'Standards',
    title: 'Freiwurf gegen Mauer',
    description:
      'Direkter Freiwurf kurz vor Schluss: Anspiel an die Kreisläuferin, die sich seitlich von der Mauer löst.',
    field: 'half',
    build: () => {
      const rm = tok('own', 'RM', 0.5, 0.31)
      const km = tok('own', 'KM', 0.56, 0.21)
      const rl = tok('own', 'RL', 0.28, 0.3)
      const rr = tok('own', 'RR', 0.72, 0.3)
      const la = tok('own', 'LA', 0.1, 0.12)
      const ra = tok('own', 'RA', 0.9, 0.12)
      const wall = [
        tok('opp', '1', 0.44, 0.245),
        tok('opp', '2', 0.5, 0.245),
        tok('opp', '3', 0.56, 0.245),
        tok('opp', 'T', 0.5, 0.0325),
      ]
      const ball = ballToken(0.5, 0.325)
      const tokens = [rm, km, rl, rr, la, ra, ...wall, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [km, 0.64, 0.155],
        [ball, 0.63, 0.17],
      ])
      return { tokens, materials: [], steps: [s0, s1] }
    },
  },
  {
    id: 'std-anwurf',
    kategorie: 'Standards',
    title: 'Anwurf — schneller Flügel',
    description:
      'Anwurf nach Halbzeit oder Tor: sofortiger Diagonalpass auf die startende Rechtsaußen statt geordnetem Aufbau.',
    field: 'full',
    build: () => {
      const tw = tok('own', 'TW', 0.5, 0.955)
      const rm = tok('own', 'RM', 0.5, 0.515)
      const rl = tok('own', 'RL', 0.38, 0.54)
      const rr = tok('own', 'RR', 0.62, 0.54)
      const la = tok('own', 'LA', 0.12, 0.53)
      const ra = tok('own', 'RA', 0.88, 0.53)
      const km = tok('own', 'KM', 0.45, 0.48)
      const ball = ballToken(0.51, 0.51)
      const tokens = [tw, rm, rl, rr, la, ra, km, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [ra, 0.9, 0.24],
        [ball, 0.88, 0.27],
        [la, 0.1, 0.3],
      ])
      return { tokens, materials: [], steps: [s0, s1] }
    },
  },
]

/* ---------- Training ---------- */

const TRAINING: LibraryEntry[] = [
  {
    id: 'trn-anspiel-kreis',
    kategorie: 'Training',
    title: 'Anspiel Kreis unter Druck',
    description:
      'KM löst sich am Kreis, RM spielt gegen den Druck an — die Hütchen markieren die Druckzonen der Abwehr.',
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
  {
    id: 'trn-passkreuz',
    kategorie: 'Training',
    title: 'Passkreuz — 4 Stationen',
    description:
      'Vier Stationen im Quadrat, Pass und der Passfolge nachlaufen — Grundlagentraining für Passhärte und Timing.',
    field: 'half',
    build: () => {
      const a = tok('own', 'A', 0.3, 0.18)
      const b = tok('own', 'B', 0.7, 0.18)
      const c = tok('own', 'C', 0.7, 0.42)
      const d = tok('own', 'D', 0.3, 0.42)
      const ball = ballToken(0.32, 0.2)
      const tokens = [a, b, c, d, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [a, 0.7, 0.18],
        [b, 0.7, 0.42],
        [c, 0.3, 0.42],
        [d, 0.3, 0.18],
        [ball, 0.68, 0.2],
      ])
      return {
        tokens,
        materials: [
          mat('huetchen', 0.26, 0.15),
          mat('huetchen', 0.74, 0.15),
          mat('huetchen', 0.74, 0.45),
          mat('huetchen', 0.26, 0.45),
        ],
        steps: [s0, s1],
      }
    },
  },
  {
    id: 'trn-gegenstoss',
    kategorie: 'Training',
    title: 'Gegenstoß-Staffel',
    description:
      'Slalom durch die Stangen, dann Tempo bis zum 9er und Abschluss — die Nächste startet mit dem Rückpass.',
    field: 'full',
    build: () => {
      const a = tok('own', 'A', 0.5, 0.9)
      const b = tok('own', 'B', 0.42, 0.94)
      const c = tok('own', 'C', 0.58, 0.94)
      const ball = ballToken(0.52, 0.89)
      const tokens = [a, b, c, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [a, 0.5, 0.55],
        [ball, 0.52, 0.56],
      ])
      const s2 = nextStep(s1, [
        [a, 0.5, 0.24],
        [ball, 0.51, 0.22],
      ])
      return {
        tokens,
        materials: [
          mat('stange', 0.44, 0.78),
          mat('stange', 0.56, 0.72),
          mat('stange', 0.44, 0.66),
          mat('stange', 0.56, 0.6),
          mat('ball-extra', 0.85, 0.92),
        ],
        steps: [s0, s1, s2],
      }
    },
  },
  {
    id: 'trn-wurfzirkel',
    kategorie: 'Training',
    title: 'Wurf-Zirkel Rückraum',
    description:
      'Von allen drei Rückraumpositionen: Anlauf über die Matte, Sprungwurf auf die Minitore in den Ecken.',
    field: 'half',
    build: () => {
      const rl = tok('own', 'RL', 0.28, 0.33)
      const rm = tok('own', 'RM', 0.5, 0.37)
      const rr = tok('own', 'RR', 0.72, 0.33)
      const ball = ballToken(0.5, 0.35)
      const tokens = [rl, rm, rr, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [rm, 0.5, 0.25],
        [ball, 0.62, 0.06],
      ])
      return {
        tokens,
        materials: [
          mat('minitor', 0.34, 0.045),
          mat('minitor', 0.66, 0.045),
          mat('matte', 0.5, 0.29),
          mat('ball-extra', 0.88, 0.46),
        ],
        steps: [s0, s1],
      }
    },
  },
  {
    id: 'trn-leiter',
    kategorie: 'Training',
    title: 'Koordination + Anspiel',
    description:
      'Durch die Koordinationsleiter, um die Stange und direkt in das Anspiel — Beinarbeit unter Ermüdung.',
    field: 'half',
    build: () => {
      const a = tok('own', 'A', 0.2, 0.46)
      const p = tok('own', 'P', 0.55, 0.3)
      const ball = ballToken(0.57, 0.31)
      const tokens = [a, p, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [[a, 0.2, 0.3]])
      const s2 = nextStep(s1, [
        [a, 0.34, 0.22],
        [ball, 0.36, 0.23],
      ])
      return {
        tokens,
        materials: [
          mat('leiter', 0.2, 0.38),
          mat('stange', 0.26, 0.26),
          mat('ball-extra', 0.6, 0.44),
        ],
        steps: [s0, s1, s2],
      }
    },
  },
  {
    id: 'trn-prellstaffel',
    kategorie: 'Training',
    title: 'Prell-Slalom',
    description:
      'Prellen im Slalom durch die Stangen, am Hütchen wenden und zurück — auch als Staffel mit zwei Gruppen.',
    field: 'half',
    build: () => {
      const a = tok('own', 'A', 0.35, 0.47)
      const b = tok('own', 'B', 0.65, 0.47)
      const ball = ballToken(0.37, 0.46)
      const tokens = [a, b, ball]
      const s0 = baseStep(tokens)
      const s1 = nextStep(s0, [
        [a, 0.35, 0.14],
        [ball, 0.36, 0.13],
      ])
      return {
        tokens,
        materials: [
          mat('stange', 0.35, 0.4),
          mat('stange', 0.3, 0.33),
          mat('stange', 0.4, 0.26),
          mat('stange', 0.35, 0.19),
          mat('huetchen', 0.35, 0.12),
          mat('stange', 0.65, 0.4),
          mat('stange', 0.6, 0.33),
          mat('stange', 0.7, 0.26),
          mat('stange', 0.65, 0.19),
          mat('huetchen', 0.65, 0.12),
        ],
        steps: [s0, s1],
      }
    },
  },
]

export const LIBRARY: LibraryEntry[] = [
  ...ABWEHR,
  ...ANGRIFF,
  ...AUSLOESUNGEN,
  ...TEMPOSPIEL,
  ...STANDARDS,
  ...TRAINING,
]

/** Bibliothekseintrag als neues, speicherbares Board. */
export function buildLibraryBoard(entry: LibraryEntry): TacticsBoard {
  const built = entry.build()
  return {
    id: uid(),
    title: entry.title,
    field: entry.field,
    tokens: built.tokens,
    materials: built.materials,
    steps: built.steps,
    tags: [entry.kategorie],
    updatedAt: new Date().toISOString(),
  }
}
