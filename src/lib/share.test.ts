import { describe, expect, it } from 'vitest'
import { deserializeBoard, serializeBoard } from './share'
import type { TacticsBoard } from './types'

function sampleBoard(): TacticsBoard {
  return {
    id: 'x',
    title: 'Kreuzung',
    field: 'half',
    tokens: [
      { id: 'a', kind: 'own', label: 'RM', x: 0.5, y: 0.37 },
      { id: 'b', kind: 'ball', x: 0.45, y: 0.4 },
    ],
    materials: [{ id: 'm', kind: 'huetchen', x: 0.3, y: 0.3 }],
    steps: [
      { a: { x: 0.5, y: 0.37 }, b: { x: 0.45, y: 0.4 } },
      { a: { x: 0.31, y: 0.24 }, b: { x: 0.52, y: 0.25 } },
    ],
    tags: ['Angriff'],
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('serialize/deserialize', () => {
  it('erhält Figuren, Material, Schritte und Tags über den Roundtrip', () => {
    const out = deserializeBoard(serializeBoard(sampleBoard()))
    expect(out.title).toBe('Kreuzung')
    expect(out.field).toBe('half')
    expect(out.tokens).toHaveLength(2)
    expect(out.tokens[0].label).toBe('RM')
    expect(out.materials[0].kind).toBe('huetchen')
    expect(out.steps).toHaveLength(2)
    expect(out.tags).toEqual(['Angriff'])
    // Schritt-Referenzen zeigen auf die NEUEN Token-Ids
    const rm = out.tokens[0]
    expect(out.steps[1][rm.id]).toEqual({ x: 0.31, y: 0.24 })
  })

  it('vergibt neue Ids (kein Konflikt mit vorhandenen Zügen)', () => {
    const out = deserializeBoard(serializeBoard(sampleBoard()))
    expect(out.id).not.toBe('x')
    expect(out.tokens[0].id).not.toBe('a')
  })

  it('erzeugt eine Grundstellung, wenn Schritte fehlen', () => {
    const data = serializeBoard(sampleBoard())
    data.s = []
    const out = deserializeBoard(data)
    expect(out.steps).toHaveLength(1)
    expect(Object.keys(out.steps[0])).toHaveLength(2)
  })
})
