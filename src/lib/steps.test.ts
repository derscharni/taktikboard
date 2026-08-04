import { describe, expect, it } from 'vitest'
import {
  ensureSteps,
  interpolateStep,
  positionInStep,
  positionsAtProgress,
  stepArrows,
} from './steps'
import type { StepPositions } from './types'
import type { TacticsBoard } from './types'

describe('interpolateStep', () => {
  it('interpoliert linear zwischen zwei Schritten', () => {
    const out = interpolateStep({ a: { x: 0, y: 0 } }, { a: { x: 1, y: 0.5 } }, 0.5)
    expect(out.a.x).toBeCloseTo(0.5)
    expect(out.a.y).toBeCloseTo(0.25)
  })

  it('hält Figuren ohne Ziel an ihrer Position', () => {
    const out = interpolateStep({ a: { x: 0.3, y: 0.3 } }, {}, 0.7)
    expect(out.a).toEqual({ x: 0.3, y: 0.3 })
  })
})

describe('positionsAtProgress', () => {
  const steps = [
    { a: { x: 0, y: 0 } },
    { a: { x: 1, y: 0 } },
    { a: { x: 1, y: 1 } },
  ]

  it('liefert Start bei u=0 und Ende bei u=1', () => {
    expect(positionsAtProgress(steps, 0).a).toEqual({ x: 0, y: 0 })
    expect(positionsAtProgress(steps, 1).a).toEqual({ x: 1, y: 1 })
  })

  it('liegt bei Segmentgrenze exakt auf dem Zwischenschritt', () => {
    const mid = positionsAtProgress(steps, 0.5)
    expect(mid.a.x).toBeCloseTo(1)
    expect(mid.a.y).toBeCloseTo(0)
  })
})

describe('positionInStep', () => {
  it('fällt auf frühere Schritte zurück', () => {
    const steps: StepPositions[] = [{ a: { x: 0.2, y: 0.2 } }, {}]
    expect(positionInStep(steps, 1, 'a', { x: 0, y: 0 })).toEqual({ x: 0.2, y: 0.2 })
  })
})

describe('stepArrows', () => {
  it('liefert nur Figuren mit echter Bewegung', () => {
    const arrows = stepArrows(
      { a: { x: 0, y: 0 }, b: { x: 0.5, y: 0.5 } },
      { a: { x: 0.4, y: 0 }, b: { x: 0.5, y: 0.5 } },
    )
    expect(arrows.map((x) => x.id)).toEqual(['a'])
  })
})

describe('ensureSteps', () => {
  it('erzeugt die Grundstellung aus den Figuren-Positionen', () => {
    const board = {
      id: 'b',
      title: 't',
      field: 'half',
      tokens: [{ id: 'a', kind: 'own', x: 0.4, y: 0.3 }],
      materials: [],
      steps: [],
      updatedAt: '',
    } as unknown as TacticsBoard
    const out = ensureSteps(board)
    expect(out.steps).toHaveLength(1)
    expect(out.steps[0].a).toEqual({ x: 0.4, y: 0.3 })
  })

  it('übernimmt alte freie Wege als Ziel-Schritt', () => {
    const board = {
      id: 'b',
      title: 't',
      field: 'half',
      tokens: [
        {
          id: 'a',
          kind: 'own',
          x: 0.9,
          y: 0.9,
          path: [
            { x: 0.1, y: 0.1 },
            { x: 0.6, y: 0.2 },
          ],
        },
      ],
      materials: [],
      steps: [],
      updatedAt: '',
    } as unknown as TacticsBoard
    const out = ensureSteps(board)
    expect(out.steps).toHaveLength(2)
    expect(out.steps[0].a).toEqual({ x: 0.1, y: 0.1 })
    expect(out.steps[1].a).toEqual({ x: 0.6, y: 0.2 })
    expect(out.tokens[0].path).toBeUndefined()
    expect(out.tokens[0].x).toBeCloseTo(0.1)
  })
})
