import { describe, expect, it } from 'vitest'
import { clampNorm } from './useBoardDrag'

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
