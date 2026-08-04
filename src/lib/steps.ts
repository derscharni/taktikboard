import type { StepPositions, TacticsBoard } from './types'

/**
 * Schritt-Logik des Spielzugs: Positionen je Schritt, Interpolation der
 * Bewegung dazwischen (die App ergänzt die Zwischenbewegung selbst) und
 * Pfeile vom aktuellen zum nächsten Schritt.
 */

export interface Pt {
  x: number
  y: number
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/** Position einer Figur in einem Schritt — fällt auf frühere Schritte zurück. */
export function positionInStep(
  steps: StepPositions[],
  step: number,
  tokenId: string,
  fallback: Pt,
): Pt {
  for (let i = Math.min(step, steps.length - 1); i >= 0; i--) {
    const p = steps[i]?.[tokenId]
    if (p) return p
  }
  return fallback
}

/** Linear zwischen zwei Schritten interpolieren (t 0..1, bereits geeast). */
export function interpolateStep(
  a: StepPositions,
  b: StepPositions,
  t: number,
): StepPositions {
  const out: StepPositions = {}
  const ids = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const id of ids) {
    const pa = a[id] ?? b[id]
    const pb = b[id] ?? a[id]
    out[id] = { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t }
  }
  return out
}

/**
 * Positionen bei globalem Abspielfortschritt u (0..1 über alle Segmente).
 * Jedes Segment (Schritt k → k+1) wird einzeln geeast, dadurch wirkt
 * die automatisch ergänzte Zwischenbewegung wie Anlaufen/Abbremsen.
 */
export function positionsAtProgress(steps: StepPositions[], u: number): StepPositions {
  if (steps.length === 0) return {}
  if (steps.length === 1) return steps[0]
  const segs = steps.length - 1
  const clamped = Math.max(0, Math.min(1, u))
  const scaled = clamped * segs
  const seg = Math.min(segs - 1, Math.floor(scaled))
  const local = easeInOut(scaled - seg)
  return interpolateStep(steps[seg], steps[seg + 1], local)
}

/** Bewegungspfeile eines Schritt-Übergangs (nur Figuren, die sich bewegen). */
export function stepArrows(
  from: StepPositions,
  to: StepPositions,
  minDist = 0.012,
): { id: string; from: Pt; to: Pt }[] {
  const out: { id: string; from: Pt; to: Pt }[] = []
  for (const id of Object.keys(to)) {
    const a = from[id]
    const b = to[id]
    if (!a || !b) continue
    if (Math.hypot(b.x - a.x, b.y - a.y) >= minDist) out.push({ id, from: a, to: b })
  }
  return out
}

/**
 * Board auf das Schritt-Modell heben: fehlende steps aus den aktuellen
 * Figuren-Positionen erzeugen; alte frei aufgezeichnete Wege (path)
 * werden als Ziel-Schritt übernommen.
 */
export function ensureSteps(board: TacticsBoard): TacticsBoard {
  if (board.steps && board.steps.length > 0) return board
  const base: StepPositions = {}
  for (const t of board.tokens) {
    const start = t.path && t.path.length > 0 ? t.path[0] : { x: t.x, y: t.y }
    base[t.id] = { x: start.x, y: start.y }
  }
  const steps: StepPositions[] = [base]
  if (board.tokens.some((t) => t.path && t.path.length > 1)) {
    const target: StepPositions = {}
    for (const t of board.tokens) {
      const end = t.path && t.path.length > 1 ? t.path[t.path.length - 1] : base[t.id]
      target[t.id] = { x: end.x, y: end.y }
    }
    steps.push(target)
  }
  return {
    ...board,
    steps,
    tokens: board.tokens.map((t) => ({
      ...t,
      x: base[t.id]?.x ?? t.x,
      y: base[t.id]?.y ?? t.y,
      path: undefined,
    })),
  }
}
