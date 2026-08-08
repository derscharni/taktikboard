import type { PointerEventHandler, ReactNode, Ref } from 'react'
import type { BoardMaterial, BoardToken, MaterialKind } from '../../lib/types'
import type { Pt } from '../../lib/steps'
import { FIELD_H, FIELD_W } from './presets'

/**
 * Handballfeld hochkant (Tore oben/unten) als SVG in Meter-Koordinaten:
 * x 0..20, y 0..40 — normierte Token-Koordinaten werden mit 20/40 skaliert.
 * Halbfeld = Angriffshälfte oben (nur anderer viewBox-Ausschnitt).
 *
 * Look "Halle": flache, klare Flächen wie ein moderner Hallenboden.
 * Die Farben (Spielfläche, Torraum, Linien) kommen als CSS-Variablen
 * --court, --court-area, --court-lines vom Screen und sind einstellbar.
 */

/** ViewBox-Maße — auch für die 3D-Ebene (HTML-Overlay) relevant. */
export const VIEW_W = 22.2
export const VIEW_H_FULL = 43.4
export const VIEW_H_HALF = 22.6
export const VIEW_PAD_X = 1.1
export const VIEW_PAD_Y = 1.7

const VIEWBOX_FULL = `-${VIEW_PAD_X} -${VIEW_PAD_Y} ${VIEW_W} ${VIEW_H_FULL}`
const VIEWBOX_HALF = `-${VIEW_PAD_X} -${VIEW_PAD_Y} ${VIEW_W} ${VIEW_H_HALF}`

const LINE = {
  stroke: 'var(--court-lines)',
  strokeWidth: 0.16,
  fill: 'none',
  strokeLinecap: 'round' as const,
}

function FieldLines() {
  return (
    <g aria-hidden="true">
      {/* Umlauf (Boden außerhalb der Spielfläche, leicht abgedunkelt) */}
      <rect
        x={-1.1}
        y={-1.7}
        width={22.2}
        height={43.4}
        fill="color-mix(in srgb, var(--court) 78%, #10131a)"
      />
      {/* Spielfläche */}
      <rect x={0} y={0} width={FIELD_W} height={FIELD_H} fill="var(--court)" />
      {/* Torraum-Zonen */}
      <path fill="var(--court-area)" d="M2.5 0 A6 6 0 0 0 8.5 6 L11.5 6 A6 6 0 0 0 17.5 0 Z" />
      <path fill="var(--court-area)" d="M2.5 40 A6 6 0 0 1 8.5 34 L11.5 34 A6 6 0 0 1 17.5 40 Z" />
      {/* Außenlinien */}
      <rect {...LINE} x={0} y={0} width={FIELD_W} height={FIELD_H} />
      {/* 6-m-Räume: zwei Viertelkreise um die Pfosten + gerades Mittelstück */}
      <path {...LINE} d="M2.5 0 A6 6 0 0 0 8.5 6 L11.5 6 A6 6 0 0 0 17.5 0" />
      <path {...LINE} d="M2.5 40 A6 6 0 0 1 8.5 34 L11.5 34 A6 6 0 0 1 17.5 40" />
      {/* 9-m-Linien (gestrichelt) */}
      <path
        {...LINE}
        strokeDasharray="0.8 0.55"
        d="M0 2.96 A9 9 0 0 0 8.5 9 L11.5 9 A9 9 0 0 0 20 2.96"
      />
      <path
        {...LINE}
        strokeDasharray="0.8 0.55"
        d="M0 37.04 A9 9 0 0 1 8.5 31 L11.5 31 A9 9 0 0 1 20 37.04"
      />
      {/* Mittellinie */}
      <line {...LINE} x1={0} y1={20} x2={20} y2={20} />
      {/* 7-m-Striche */}
      <line {...LINE} x1={9.5} y1={7} x2={10.5} y2={7} />
      <line {...LINE} x1={9.5} y1={33} x2={10.5} y2={33} />
      {/* 4-m-Marken */}
      <line {...LINE} x1={9.65} y1={4} x2={10.35} y2={4} />
      <line {...LINE} x1={9.65} y1={36} x2={10.35} y2={36} />
      {/* Tore in Vereinsgelb */}
      <rect x={8.5} y={-0.5} width={3} height={0.5} fill="var(--club-acc)" />
      <rect x={8.5} y={40} width={3} height={0.5} fill="var(--club-acc)" />
    </g>
  )
}

/* ---------- Material-Glyphen ---------- */

export function MatGlyph({ kind }: { kind: MaterialKind }): ReactNode {
  switch (kind) {
    case 'huetchen':
      return (
        <>
          <path d="M-.75 .6 L0 -.85 L.75 .6 Z" fill="#E08A3C" stroke="#9A5A20" strokeWidth={0.08} />
          <line x1={-1.05} y1={0.6} x2={1.05} y2={0.6} stroke="#9A5A20" strokeWidth={0.12} />
        </>
      )
    case 'stange':
      return (
        <>
          <ellipse cx={0} cy={1.3} rx={0.6} ry={0.2} fill="#9AA0AA" opacity={0.8} />
          <rect x={-0.14} y={-1.35} width={0.28} height={2.6} rx={0.14} fill="#C0432F" />
          <rect x={-0.14} y={-0.6} width={0.28} height={0.55} fill="#F2E7DC" />
        </>
      )
    case 'leiter':
      return (
        <g stroke="#F2E7DC" strokeWidth={0.13} fill="none">
          <line x1={-1.55} y1={-0.55} x2={1.55} y2={-0.55} />
          <line x1={-1.55} y1={0.55} x2={1.55} y2={0.55} />
          <line x1={-1.55} y1={-0.55} x2={-1.55} y2={0.55} />
          <line x1={-0.78} y1={-0.55} x2={-0.78} y2={0.55} />
          <line x1={0} y1={-0.55} x2={0} y2={0.55} />
          <line x1={0.78} y1={-0.55} x2={0.78} y2={0.55} />
          <line x1={1.55} y1={-0.55} x2={1.55} y2={0.55} />
        </g>
      )
    case 'matte':
      return (
        <>
          <rect
            x={-1.35}
            y={-0.85}
            width={2.7}
            height={1.7}
            rx={0.26}
            fill="#4C9EB8"
            opacity={0.9}
            stroke="#2E6E85"
            strokeWidth={0.08}
          />
          <line x1={-0.68} y1={-0.85} x2={-0.68} y2={0.85} stroke="#2E6E85" strokeWidth={0.07} />
          <line x1={0.68} y1={-0.85} x2={0.68} y2={0.85} stroke="#2E6E85" strokeWidth={0.07} />
        </>
      )
    case 'minitor':
      return (
        <>
          <rect x={-1.15} y={-0.8} width={2.3} height={1.6} fill="none" stroke="#C0432F" strokeWidth={0.15} />
          <g stroke="#F0F2F5" strokeWidth={0.05}>
            <line x1={-0.75} y1={-0.8} x2={-0.75} y2={0.8} />
            <line x1={-0.38} y1={-0.8} x2={-0.38} y2={0.8} />
            <line x1={0} y1={-0.8} x2={0} y2={0.8} />
            <line x1={0.38} y1={-0.8} x2={0.38} y2={0.8} />
            <line x1={0.75} y1={-0.8} x2={0.75} y2={0.8} />
            <line x1={-1.15} y1={-0.27} x2={1.15} y2={-0.27} />
            <line x1={-1.15} y1={0.27} x2={1.15} y2={0.27} />
          </g>
        </>
      )
    case 'ball-extra':
      return (
        <>
          <circle r={1.05} fill="none" stroke="#F2E7DC" strokeWidth={0.11} />
          <circle cx={-0.34} cy={-0.16} r={0.34} fill="#E3A23F" />
          <circle cx={0.36} cy={-0.1} r={0.34} fill="#E3A23F" />
          <circle cx={0} cy={0.44} r={0.34} fill="#E3A23F" />
        </>
      )
    default:
      return null
  }
}

/* ---------- Schritt-Pfeile ---------- */

export interface CourtArrow {
  id: string
  from: Pt
  to: Pt
  isBall: boolean
}

function Arrow({ a }: { a: CourtArrow }) {
  const x1 = a.from.x * FIELD_W
  const y1 = a.from.y * FIELD_H
  const x2 = a.to.x * FIELD_W
  const y2 = a.to.y * FIELD_H
  let dx = x2 - x1
  let dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  dx /= len
  dy /= len
  const s = 0.85
  const w = 0.42
  const color = a.isBall ? 'var(--club-acc)' : 'var(--court-lines)'
  // Pfeil endet kurz vor der Zielposition, damit die Figur frei bleibt
  const ex = x2 - dx * 1.5
  const ey = y2 - dy * 1.5
  return (
    <g opacity={0.9}>
      <line
        x1={x1}
        y1={y1}
        x2={ex}
        y2={ey}
        stroke={color}
        strokeWidth={a.isBall ? 0.24 : 0.26}
        strokeLinecap="round"
        strokeDasharray={a.isBall ? undefined : '0.7 0.5'}
      />
      <path
        d={`M${(ex + dx * s).toFixed(2)} ${(ey + dy * s).toFixed(2)} L${(ex - dy * w).toFixed(2)} ${(ey + dx * w).toFixed(2)} L${(ex + dy * w).toFixed(2)} ${(ey - dx * w).toFixed(2)} Z`}
        fill={color}
      />
    </g>
  )
}

/* ---------- Figuren ---------- */

function TokenG({
  token,
  selected,
  registerEl,
}: {
  token: BoardToken
  selected: boolean
  registerEl: (el: SVGGElement | null) => void
}) {
  const isBall = token.kind === 'ball'
  const isOpp = token.kind === 'opp'
  const r = isBall ? 0.62 : 1.12
  const hit = isBall ? 1.5 : 1.9
  return (
    <g
      data-tok={token.id}
      ref={registerEl}
      transform={`translate(${(token.x * FIELD_W).toFixed(2)} ${(token.y * FIELD_H).toFixed(2)})`}
      style={{ cursor: 'grab' }}
    >
      {/* großzügige, unsichtbare Trefffläche (Touch ≥ 44 px) */}
      <circle r={hit} fill="transparent" />
      {selected && (
        <circle
          r={r + 0.45}
          fill="none"
          stroke="var(--club-acc)"
          strokeWidth={0.22}
          strokeDasharray="0.55 0.4"
        />
      )}
      {isBall ? (
        <>
          <circle r={r} fill="var(--club-acc)" stroke="color-mix(in srgb, var(--club-acc-ink) 55%, transparent)" strokeWidth={0.14} />
          <path
            d="M-.3 -.48 A.62 .62 0 0 0 -.3 .48 M.3 -.48 A.62 .62 0 0 1 .3 .48"
            stroke="var(--club-acc-ink)"
            strokeWidth={0.09}
            fill="none"
          />
        </>
      ) : isOpp ? (
        /* Gegnerin: dunkler Chip, klar von den eigenen unterscheidbar */
        <circle r={r} fill="#272c35" stroke="rgba(255,255,255,0.65)" strokeWidth={0.12} />
      ) : (
        /* Eigene: heller Chip mit Vereinsblau — knackig auf jedem Boden */
        <circle r={r} fill="#ffffff" stroke="var(--club-700)" strokeWidth={0.18} />
      )}
      {token.label && (
        <text
          y={0.34}
          textAnchor="middle"
          fontSize={0.92}
          fill={isOpp ? '#f0f2f5' : 'var(--club-700)'}
          style={{ fontFamily: 'var(--font-display)', fontWeight: 800, pointerEvents: 'none' }}
        >
          {token.label}
        </text>
      )}
    </g>
  )
}

/* ---------- Feld-Komponente ---------- */

export default function Court({
  field,
  tokens,
  materials,
  arrows,
  selectedId,
  ghost,
  svgRef,
  registerTokenEl,
  hideFigures = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  field: 'full' | 'half'
  tokens: BoardToken[]
  materials: BoardMaterial[]
  /** Bewegungspfeile: aktueller Schritt → nächster Schritt. */
  arrows: CourtArrow[]
  selectedId: string | null
  /** Material-Vorschau beim Ziehen aus der Ablage. */
  ghost: { kind: MaterialKind; x: number; y: number } | null
  svgRef: Ref<SVGSVGElement>
  registerTokenEl: (id: string) => (el: SVGGElement | null) => void
  /** 3D-Ansicht: Figuren/Material im SVG verstecken — sie stehen dann als Aufsteller im Raum. */
  hideFigures?: boolean
  onPointerDown: PointerEventHandler<SVGSVGElement>
  onPointerMove: PointerEventHandler<SVGSVGElement>
  onPointerUp: PointerEventHandler<SVGSVGElement>
  onPointerCancel: PointerEventHandler<SVGSVGElement>
}) {
  return (
    <svg
      ref={svgRef}
      viewBox={field === 'half' ? VIEWBOX_HALF : VIEWBOX_FULL}
      preserveAspectRatio="xMidYMid meet"
      role="application"
      aria-label="Taktikboard — Handballfeld hochkant mit verschiebbaren Figuren"
      className="block h-full w-full select-none"
      style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <FieldLines />
      {/* Bewegungspfeile zum nächsten Schritt */}
      <g pointerEvents="none">
        {arrows.map((a) => (
          <Arrow key={`arrow-${a.id}`} a={a} />
        ))}
      </g>
      {/* Trainingsmaterial (wird nie animiert) */}
      <g data-hide3d="" style={hideFigures ? { visibility: 'hidden' } : undefined}>
        {materials.map((m) => (
          <g
            key={m.id}
            data-mat={m.id}
            transform={`translate(${(m.x * FIELD_W).toFixed(2)} ${(m.y * FIELD_H).toFixed(2)})`}
            style={{ cursor: 'grab' }}
          >
            <circle r={1.9} fill="transparent" />
            <MatGlyph kind={m.kind} />
          </g>
        ))}
      </g>
      {/* Figuren */}
      <g data-hide3d="" style={hideFigures ? { visibility: 'hidden' } : undefined}>
        {tokens.map((t) => (
          <TokenG
            key={t.id}
            token={t}
            selected={t.id === selectedId}
            registerEl={registerTokenEl(t.id)}
          />
        ))}
      </g>
      {ghost && (
        <g
          opacity={0.6}
          pointerEvents="none"
          transform={`translate(${(ghost.x * FIELD_W).toFixed(2)} ${(ghost.y * FIELD_H).toFixed(2)})`}
        >
          <MatGlyph kind={ghost.kind} />
        </g>
      )}
    </svg>
  )
}
