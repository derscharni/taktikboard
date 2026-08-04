import { useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Pt } from '../../lib/steps'
import { FIELD_H, FIELD_W } from './presets'

/**
 * Pointer-Logik des Taktikboards: Figuren/Material verschieben und
 * Antippen (öffnet Aktions-Popover). Laufwege entstehen nicht mehr durch
 * freies Aufzeichnen, sondern über die Schrittfolge des Spielzugs.
 */

export type FieldMode = 'full' | 'half'

/** Client-Koordinaten → normierte Feldkoordinaten (exakt via getScreenCTM). */
export function svgPointNorm(svg: SVGSVGElement, clientX: number, clientY: number): Pt {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0.5, y: 0.5 }
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
  return { x: p.x / FIELD_W, y: p.y / FIELD_H }
}

const MARGIN_M = 0.6

/** Punkt ins Feld klemmen (Halbfeld: nur die obere Angriffshälfte). */
export function clampNorm(p: Pt, field: FieldMode): Pt {
  const maxY = field === 'half' ? (FIELD_H / 2 - MARGIN_M) / FIELD_H : (FIELD_H - MARGIN_M) / FIELD_H
  return {
    x: Math.min((FIELD_W - MARGIN_M) / FIELD_W, Math.max(MARGIN_M / FIELD_W, p.x)),
    y: Math.min(maxY, Math.max(MARGIN_M / FIELD_H, p.y)),
  }
}

/* ---------- Drag-Hook ---------- */

type SvgPointerEvent = ReactPointerEvent<SVGSVGElement>

export interface BoardDragOptions {
  field: FieldMode
  /** Während der Animation keine Eingaben. */
  disabled: boolean
  getToken: (id: string) => Pt | undefined
  getMaterial: (id: string) => Pt | undefined
  moveToken: (id: string, x: number, y: number) => void
  moveMaterial: (id: string, x: number, y: number) => void
  /** Nach dem Loslassen einer Figur (Position in den Schritt übernehmen). */
  onTokenDropped: (id: string) => void
  onTapToken: (id: string, clientX: number, clientY: number) => void
  onTapMaterial: (id: string, clientX: number, clientY: number) => void
  onTapBackground: () => void
  onDragStart?: () => void
}

interface DragState {
  pointerId: number
  kind: 'token' | 'material'
  id: string
  moved: boolean
  startClientX: number
  startClientY: number
  startX: number
  startY: number
}

export function useBoardDrag(o: BoardDragOptions) {
  const drag = useRef<DragState | null>(null)

  const onPointerDown = (e: SvgPointerEvent) => {
    if (o.disabled || drag.current) return
    const target = e.target as Element
    const tokEl = target.closest('[data-tok]')
    const matEl = tokEl ? null : target.closest('[data-mat]')
    if (!tokEl && !matEl) {
      o.onTapBackground()
      return
    }
    e.preventDefault()
    const isMat = !!matEl
    const id = (isMat ? matEl.getAttribute('data-mat') : tokEl!.getAttribute('data-tok')) ?? ''
    const pos = isMat ? o.getMaterial(id) : o.getToken(id)
    if (!pos) return
    drag.current = {
      pointerId: e.pointerId,
      kind: isMat ? 'material' : 'token',
      id,
      moved: false,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    }
    o.onDragStart?.()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* Pointer bereits weg — unkritisch */
    }
  }

  const onPointerMove = (e: SvgPointerEvent) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    if (Math.abs(e.clientX - d.startClientX) + Math.abs(e.clientY - d.startClientY) > 7) {
      d.moved = true
    }
    const p = clampNorm(svgPointNorm(e.currentTarget, e.clientX, e.clientY), o.field)
    if (d.kind === 'material') o.moveMaterial(d.id, p.x, p.y)
    else o.moveToken(d.id, p.x, p.y)
  }

  const endDrag = (e: SvgPointerEvent, cancelled: boolean) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pointerId) return
    drag.current = null
    if (d.kind === 'material') {
      if (cancelled) o.moveMaterial(d.id, d.startX, d.startY)
      else if (!d.moved) o.onTapMaterial(d.id, e.clientX, e.clientY)
      return
    }
    if (cancelled) {
      o.moveToken(d.id, d.startX, d.startY)
      return
    }
    if (!d.moved) {
      o.moveToken(d.id, d.startX, d.startY)
      o.onTapToken(d.id, e.clientX, e.clientY)
    } else {
      o.onTokenDropped(d.id)
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: SvgPointerEvent) => endDrag(e, false),
    onPointerCancel: (e: SvgPointerEvent) => endDrag(e, true),
  }
}
