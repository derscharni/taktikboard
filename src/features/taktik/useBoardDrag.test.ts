import { describe, expect, it } from 'vitest'
import { clampNorm, easeInOut, pathLenM, pointAtPath } from './useBoardDrag'

describe('clampNorm', () => {
  it('hält Punkte innerhalb des Ganzfelds', () => {
    const p = clampNorm({ x: -1, y: 2 }, 'full')
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.x).toBeLessThanOrEqual(1)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeLessThanOrEqual(1)
  })

  it('begrenzt das Halbfeld auf die obere Hälfte', () => {
    const p = clampNorm({ x: 0.5, y: 0.9 }, 'half')
    expect(p.y).toBeLessThan(0.5)
  })
})

describe('pathLenM', () => {
  it('berechnet die Länge eines geraden Wegs in Metern (Feld 20×40 m)', () => {
    // x 0 -> 1 entspricht 20 m (normierte Koordinaten × FIELD_W)
    const len = pathLenM([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    expect(len).toBeCloseTo(20, 5)
  })

  it('summiert mehrere Segmente', () => {
    const len = pathLenM([
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 0.5, y: 0.25 },
    ])
    // 10 m + 10 m (0.25 × 40 m Feldhöhe)
    expect(len).toBeCloseTo(20, 5)
  })
})

describe('pointAtPath', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]

  it('liefert den Startpunkt bei u=0', () => {
    expect(pointAtPath(path, 0)).toEqual({ x: 0, y: 0 })
  })

  it('liefert den Endpunkt bei u=1', () => {
    expect(pointAtPath(path, 1)).toEqual({ x: 1, y: 0 })
  })

  it('interpoliert bogenlängen-parametrisiert in der Mitte', () => {
    const p = pointAtPath(path, 0.5)
    expect(p.x).toBeCloseTo(0.5, 5)
  })
})

describe('easeInOut', () => {
  it('ist an den Rändern identisch zur Eingabe', () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(1)).toBe(1)
  })

  it('ist bei 0.5 symmetrisch', () => {
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 5)
  })
})
