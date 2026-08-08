import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, uid } from '../../lib/db'
import type { FieldColors, MaterialKind, StepPositions, TacticsBoard } from '../../lib/types'
import { DEFAULT_FIELD_COLORS, FIELD_COLOR_PRESETS } from '../../lib/types'
import { Badge, Button, Card, Segmented, Sheet } from '../../components/ui'
import Court, {
  MatGlyph,
  VIEW_H_FULL,
  VIEW_H_HALF,
  VIEW_PAD_X,
  VIEW_PAD_Y,
  VIEW_W,
} from './Court'
import type { CourtArrow } from './Court'
import {
  FIELD_H,
  FIELD_W,
  MATERIAL_KINDS,
  MATERIAL_LABEL,
  NEW_BOARD_OPTIONS,
  PRESETS,
  buildPresetBoard,
  makeNewBoard,
  oppDefenseTokens,
} from './presets'
import type { NewBoardKind } from './presets'
import { LIBRARY, LIBRARY_CATEGORIES, buildLibraryBoard } from './library'
import {
  boardFromFile,
  boardFromLocationHash,
  boardToPngBlob,
  boardToShareUrl,
  clearShareHash,
  downloadBoardFile,
} from '../../lib/share'
import type { LibraryCategory, LibraryEntry } from './library'
import {
  ensureSteps,
  positionInStep,
  positionsAtProgress,
  stepArrows,
} from '../../lib/steps'
import { clampNorm, svgPointNorm, useBoardDrag } from './useBoardDrag'

/**
 * Taktik-Board: Spielzüge als Schrittfolge aufbauen (Schritt 1, 2, 3 …),
 * die Bewegung dazwischen ergänzt das Board beim Abspielen automatisch.
 * Dazu: 3D-Diorama-Ansicht zum Schwenken, einstellbare Feldfarben,
 * Trainingsmaterial und gespeicherte Züge mit Tags.
 */

const HINT_DEFAULT =
  'Stell die Figuren für Schritt 1 auf. „+“ legt den nächsten Schritt an — verschieb dann die Figuren an ihre Ziele. Figuren, Material & mehr findest du unter „Werkzeuge“.'
const HINT_3D =
  'Diorama: Ziehen dreht rundherum, Kneifen oder Scrollen zoomt. Abspielen unten — bearbeitet wird in der 2D-Ansicht.'

/** Dauer eines Schritt-Übergangs beim Abspielen (ms). */
const SEGMENT_MS = 1400

function Icon({ d, className = 'h-3.5 w-3.5' }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

const IC_SHIELD = 'M12 3l7 2.5V11c0 4.5-3 7.6-7 9.5-4-1.9-7-5-7-9.5V5.5Z'
const IC_TOOLS = 'M4 6.5h9M17 6.5h3M13 4v5M4 12h3M11 12h9M7 9.5v5M4 17.5h11M19 17.5h1M15 15v5'
const IC_CHEV = 'M9.5 6l6 6-6 6'
const IC_PLAY = 'M8 5.5v13l10-6.5Z'
const IC_STOP = 'M7.5 7.5h9v9h-9Z'
const IC_PLUS = 'M12 5v14M5 12h14'
const IC_TRASH = 'M5 7h14M9.5 7V4.5h5V7M7 7l1 13h8l1-13'
const IC_BOOKMARK = 'M7 4h10v16l-5-3.5L7 20Z'
const IC_PALETTE = 'M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a1.5 1.5 0 0 1 0-3h6.5A3.5 3.5 0 0 0 22 10.5 8.5 8.5 0 0 0 12 3ZM7.5 10.5h.01M11 7h.01M15.5 8.5h.01'
const IC_CUBE = 'M12 3 20 7.5v9L12 21l-8-4.5v-9Z M12 12 20 7.5 M12 12v9 M12 12 4 7.5'
const IC_EXPAND = 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'
const IC_CLOSE = 'M6 6l12 12M18 6 6 18'
const IC_SHARE = 'M12 15V4M12 4 8.5 7.5M12 4l3.5 3.5M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12'
const IC_BOOK = 'M5 4.5h6a2.5 2.5 0 0 1 2.5 2.5v12.5a2 2 0 0 0-2-2H5Z M19 4.5h-5.5A2.5 2.5 0 0 0 11 7 M19 4.5v13h-6.5'

function Chip({
  pressed,
  onClick,
  children,
  ariaLabel,
}: {
  pressed?: boolean
  onClick: () => void
  children: ReactNode
  ariaLabel?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      className={`inline-flex min-h-11 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[12px] font-semibold ${
        pressed
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-line bg-card text-ink'
      }`}
    >
      {children}
    </button>
  )
}

/* ---------- 3D-Aufsteller: Figuren & Material stehen im Diorama aufrecht ---------- */

/** Normierte Position → Prozent auf der Feld-Ebene (inkl. ViewBox-Rand). */
function planePct(x: number, y: number, vbH: number): { left: string; top: string } {
  return {
    left: `${(((x * FIELD_W + VIEW_PAD_X) / VIEW_W) * 100).toFixed(3)}%`,
    top: `${(((y * FIELD_H + VIEW_PAD_Y) / vbH) * 100).toFixed(3)}%`,
  }
}

function Standee({
  left,
  top,
  size,
  rx,
  rz,
  animate,
  chipRef,
  shadowRef,
  shadowScale = 0.92,
  lift = 0,
  tilt = 0,
  height,
  children,
}: {
  left: string
  top: string
  size: number
  rx: number
  rz: number
  animate: boolean
  chipRef?: (el: HTMLDivElement | null) => void
  shadowRef?: (el: HTMLDivElement | null) => void
  /** Schattenbreite relativ zur Figurbreite. */
  shadowScale?: number
  /** Schwebehöhe über dem Boden (px auf der Ebene). */
  lift?: number
  /** Rest-Neigung: 0 = exakt zur Kamera, >0 lässt etwas Draufsicht zu (wirkt plastischer). */
  tilt?: number
  /** Höhe des Aufstellers (Standard: quadratisch = size). */
  height?: number
  children: ReactNode
}) {
  const transition = animate ? 'transform 320ms ease, left 320ms ease, top 320ms ease' : undefined
  return (
    <>
      {/* Bodenschatten bleibt flach auf der Ebene liegen */}
      <div
        ref={shadowRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          left,
          top,
          width: size * shadowScale,
          height: size * 0.3,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: `radial-gradient(closest-side, rgba(6,9,14,${lift > 0 ? 0.34 : 0.42}), rgba(6,9,14,0) 78%)`,
          transition,
        }}
      />
      {/* Figur: Gegenrotation zur Feldneigung, schwebt leicht über der Ebene */}
      <div
        ref={chipRef}
        style={{
          position: 'absolute',
          left,
          top,
          width: size,
          height: height ?? size,
          transformOrigin: '50% 100%',
          transform: `translate(-50%, -100%) translateZ(${lift}px) rotateZ(${-rz}deg) rotateX(${-(rx - tilt)}deg)`,
          transition,
        }}
      >
        {children}
      </div>
    </>
  )
}

/** Diorama-Sockel: gibt der Feld-Ebene sichtbare Dicke (4 Seitenwände + Bodenschatten). */
function Slab({ w, h, t, court }: { w: number; h: number; t: number; court: string }) {
  const side = (extra: CSSProperties, shade: number): CSSProperties => ({
    position: 'absolute',
    background: `color-mix(in srgb, ${court} ${shade}%, #0a0d13)`,
    boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,0.18)',
    ...extra,
  })
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
      {/* weicher Schlagschatten unter dem Sockel */}
      <div
        style={{
          position: 'absolute',
          inset: '-5%',
          transform: `translateZ(${-t - 1}px)`,
          background: 'radial-gradient(closest-side, rgba(0,0,0,0.5), rgba(0,0,0,0) 82%)',
        }}
      />
      {/* Nord / Süd / West / Ost — Wände klappen von der Kante nach unten */}
      <div style={side({ left: 0, top: 0, width: w, height: t, transformOrigin: '50% 0', transform: 'rotateX(-90deg)' }, 52)} />
      <div style={side({ left: 0, top: '100%', width: w, height: t, transformOrigin: '50% 0', transform: 'rotateX(-90deg)' }, 34)} />
      <div style={side({ left: 0, top: 0, width: t, height: h, transformOrigin: '0 50%', transform: 'rotateY(90deg)' }, 46)} />
      <div style={side({ left: '100%', top: 0, width: t, height: h, transformOrigin: '0 50%', transform: 'rotateY(90deg)' }, 28)} />
    </div>
  )
}

function Layer3D({
  tokens,
  materials,
  field,
  rx,
  rz,
  animate,
  chipPx,
  ballPx,
  register,
}: {
  tokens: TacticsBoard['tokens']
  materials: TacticsBoard['materials']
  field: 'full' | 'half'
  rx: number
  rz: number
  animate: boolean
  chipPx: number
  ballPx: number
  register: (id: string, part: 'chip' | 'shadow') => (el: HTMLDivElement | null) => void
}) {
  const vbH = field === 'half' ? VIEW_H_HALF : VIEW_H_FULL
  const border = Math.max(2, chipPx * 0.085)
  const matPx = chipPx * 1.15
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {materials.map((m) => {
        const p = planePct(m.x, m.y, vbH)
        return (
          <Standee key={m.id} {...p} size={matPx} rx={rx} rz={rz} animate={animate} shadowScale={0.72} tilt={4}>
            <svg
              viewBox="-2 -2 4 4"
              width={matPx}
              height={matPx}
              style={{ display: 'block', filter: 'drop-shadow(0 1.5px 1.5px rgba(6,9,14,0.35))' }}
            >
              <MatGlyph kind={m.kind} />
            </svg>
          </Standee>
        )
      })}
      {tokens.map((t) => {
        const isBall = t.kind === 'ball'
        const isOpp = t.kind === 'opp'
        const p = planePct(t.x, t.y, vbH)
        if (isBall) {
          const size = ballPx
          return (
            <Standee
              key={t.id}
              {...p}
              size={size}
              rx={rx}
              rz={rz}
              animate={animate}
              lift={size * 0.22}
              shadowScale={0.8}
              chipRef={register(t.id, 'chip')}
              shadowRef={register(t.id, 'shadow')}
            >
              <div
                style={{
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  backgroundColor: 'var(--club-acc)',
                  backgroundImage:
                    'radial-gradient(circle at 33% 28%, #ffe9a3 0%, var(--club-acc) 52%, color-mix(in srgb, var(--club-acc) 55%, #6b4d00) 100%)',
                  border: `1px solid color-mix(in srgb, var(--club-acc-ink) 45%, transparent)`,
                  boxShadow: '0 2px 6px rgba(6,9,14,0.45)',
                }}
              />
            </Standee>
          )
        }
        // Map-Pin: runder Kopf mit Kürzel, Spitze zeigt auf die Position
        const size = chipPx
        const tail = size * 0.34
        const pinH = size + tail
        const tailColor = isOpp ? '#272c35' : 'var(--club-700)'
        return (
          <Standee
            key={t.id}
            {...p}
            size={size}
            height={pinH}
            rx={rx}
            rz={rz}
            animate={animate}
            lift={size * 0.12}
            shadowScale={0.55}
            chipRef={register(t.id, 'chip')}
            shadowRef={register(t.id, 'shadow')}
          >
            <div style={{ position: 'relative', width: size, height: pinH }}>
              {/* Spitze */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: size * 0.82,
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: `${size * 0.18}px solid transparent`,
                  borderRight: `${size * 0.18}px solid transparent`,
                  borderTop: `${tail + size * 0.18}px solid ${tailColor}`,
                  filter: 'drop-shadow(0 1.5px 2px rgba(6,9,14,0.35))',
                }}
              />
              {/* Kopf */}
              <div
                style={{
                  position: 'absolute',
                  inset: `0 0 auto 0`,
                  height: size,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: size * 0.36,
                  lineHeight: 1,
                  ...(isOpp
                    ? {
                        backgroundColor: '#272c35',
                        backgroundImage:
                          'radial-gradient(circle at 34% 26%, #3a4150 0%, #272c35 58%, #171b22 100%)',
                        border: `${border * 0.75}px solid rgba(255,255,255,0.65)`,
                        color: '#f0f2f5',
                        boxShadow:
                          'inset 0 1.5px 2px rgba(255,255,255,0.22), inset 0 -2px 4px rgba(0,0,0,0.5), 0 2.5px 8px rgba(6,9,14,0.45)',
                      }
                    : {
                        backgroundColor: '#f6f8fc',
                        backgroundImage:
                          'radial-gradient(circle at 34% 26%, #ffffff 0%, #f6f8fc 58%, #d9dfeb 100%)',
                        border: `${border}px solid var(--club-700)`,
                        color: 'var(--club-700)',
                        boxShadow:
                          'inset 0 1.5px 2px rgba(255,255,255,0.9), inset 0 -2.5px 5px rgba(20,40,80,0.28), 0 2.5px 8px rgba(6,9,14,0.45)',
                      }),
                }}
              >
                {t.label}
              </div>
            </div>
          </Standee>
        )
      })}
    </div>
  )
}

/** "10.07.2026, 18:42" (lokale Zeit) */
function fmtStamp(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`
}

/* ---------- "Meine Züge"-Sheet ---------- */

function BoardsSheet({
  open,
  onClose,
  currentId,
  onLoad,
  onRename,
  onDelete,
  onNew,
}: {
  open: boolean
  onClose: () => void
  currentId: string | null
  onLoad: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  onNew: () => void
}) {
  const boards = useLiveQuery(() => db.boards.orderBy('updatedAt').reverse().toArray(), [])
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [tagEditId, setTagEditId] = useState<string | null>(null)
  const [tagVal, setTagVal] = useState('')

  useEffect(() => {
    if (!open) {
      setRenameId(null)
      setConfirmId(null)
      setTagFilter(null)
      setTagEditId(null)
    }
  }, [open])

  const allTags = Array.from(
    new Set((boards ?? []).flatMap((b) => b.tags ?? [])),
  ).sort((a, b) => a.localeCompare(b, 'de'))
  const visibleBoards = (boards ?? []).filter(
    (b) => tagFilter === null || (b.tags ?? []).includes(tagFilter),
  )

  async function addTag(id: string) {
    const tag = tagVal.trim()
    setTagVal('')
    if (tag === '') {
      setTagEditId(null)
      return
    }
    const b = await db.boards.get(id)
    if (!b) return
    const tags = Array.from(new Set([...(b.tags ?? []), tag]))
    await db.boards.update(id, { tags })
    setTagEditId(null)
  }

  async function removeTag(id: string, tag: string) {
    const b = await db.boards.get(id)
    if (!b) return
    const tags = (b.tags ?? []).filter((t) => t !== tag)
    await db.boards.update(id, { tags })
    if (tagFilter === tag && !(boards ?? []).some((x) => x.id !== id && (x.tags ?? []).includes(tag))) {
      setTagFilter(null)
    }
  }

  const saveRename = (id: string) => {
    onRename(id, renameVal.trim() || 'Ohne Titel')
    setRenameId(null)
  }

  return (
    <Sheet open={open} onClose={onClose} title="Meine Züge">
      <div className="flex flex-col gap-2">
        <Button variant="secondary" onClick={onNew}>
          <Icon d={IC_PLUS} className="h-4 w-4" /> Neuer Zug
        </Button>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Nach Tag filtern">
            <button
              aria-pressed={tagFilter === null}
              onClick={() => setTagFilter(null)}
              className={`min-h-11 rounded-full px-3 text-[12px] font-semibold ${
                tagFilter === null ? 'bg-accent text-btn-ink' : 'border border-line text-muted'
              }`}
            >
              Alle
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                aria-pressed={tagFilter === t}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={`min-h-11 rounded-full px-3 text-[12px] font-semibold ${
                  tagFilter === t ? 'bg-accent text-btn-ink' : 'border border-line text-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {boards && boards.length === 0 && (
          <p className="py-2 text-center text-[13px] text-muted">Noch keine gespeicherten Züge.</p>
        )}
        {boards && boards.length > 0 && visibleBoards.length === 0 && (
          <p className="py-2 text-center text-[13px] text-muted">
            Kein Zug mit diesem Tag — Filter oben zurücksetzen.
          </p>
        )}
        {visibleBoards.map((b) => (
          <Card key={b.id} className="p-3">
            {renameId === b.id ? (
              <div className="flex items-center gap-2">
                <input
                  value={renameVal}
                  onChange={(e) => setRenameVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveRename(b.id)
                  }}
                  aria-label="Neuer Name"
                  autoFocus
                  className="min-w-0 flex-1 rounded-lg border border-line bg-card-2 px-2 py-2 text-[14px] text-ink outline-none focus:border-accent"
                />
                <Button onClick={() => saveRename(b.id)} className="flex-none">
                  OK
                </Button>
              </div>
            ) : (
              <>
                <button className="flex w-full items-center gap-3 text-left" onClick={() => onLoad(b.id)}>
                  <BoardThumb board={b} />
                  <span className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-display text-[14px] font-bold uppercase tracking-wide">
                      <span className="truncate">{b.title || 'Ohne Titel'}</span>
                      {b.id === currentId && <Badge tone="accent">Geöffnet</Badge>}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {fmtStamp(b.updatedAt)} · {(b.steps ?? []).length || 1}{' '}
                      {((b.steps ?? []).length || 1) === 1 ? 'Schritt' : 'Schritte'} ·{' '}
                      {b.tokens.length} Figuren
                      {b.field === 'full' ? ' · ganzes Feld' : ''}
                    </p>
                  </span>
                </button>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {(b.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex min-h-11 items-center gap-1 rounded-full bg-club-acc px-2.5 text-[11px] font-semibold text-club-acc-ink"
                    >
                      {t}
                      <button
                        aria-label={`Tag ${t} entfernen`}
                        className="px-0.5 font-bold"
                        onClick={() => void removeTag(b.id, t)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {tagEditId === b.id ? (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void addTag(b.id)
                      }}
                    >
                      <input
                        value={tagVal}
                        onChange={(e) => setTagVal(e.target.value)}
                        onBlur={() => void addTag(b.id)}
                        aria-label="Neuer Tag"
                        placeholder="z.B. Angriff"
                        autoFocus
                        maxLength={24}
                        className="min-h-11 w-28 rounded-full border border-line bg-card-2 px-2.5 text-[12px] outline-none focus:border-accent"
                      />
                    </form>
                  ) : (
                    <button
                      className="min-h-11 rounded-full border border-dashed border-line px-2.5 text-[11px] font-semibold text-muted active:bg-accent-soft active:text-accent"
                      onClick={() => {
                        setTagEditId(b.id)
                        setTagVal('')
                      }}
                    >
                      + Tag
                    </button>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="min-h-11 flex-1 rounded-lg bg-accent-soft px-2 text-[12px] font-semibold text-accent active:opacity-80"
                    onClick={() => onLoad(b.id)}
                  >
                    Laden
                  </button>
                  <button
                    className="min-h-11 flex-1 rounded-lg border border-line px-2 text-[12px] font-semibold text-ink active:bg-card-2"
                    onClick={() => {
                      setRenameId(b.id)
                      setRenameVal(b.title)
                      setConfirmId(null)
                    }}
                  >
                    Umbenennen
                  </button>
                  <button
                    className={`min-h-11 flex-1 rounded-lg px-2 text-[12px] font-semibold active:opacity-80 ${
                      confirmId === b.id
                        ? 'bg-crit text-white'
                        : 'bg-crit-soft text-crit'
                    }`}
                    onClick={() => {
                      if (confirmId === b.id) {
                        setConfirmId(null)
                        onDelete(b.id)
                      } else {
                        setConfirmId(b.id)
                      }
                    }}
                  >
                    {confirmId === b.id ? 'Wirklich löschen?' : 'Löschen'}
                  </button>
                </div>
              </>
            )}
          </Card>
        ))}
      </div>
    </Sheet>
  )
}

/* ---------- Hauptscreen ---------- */

export default function TaktikScreen() {
  const [board, setBoard] = useState<TacticsBoard | null>(null)
  const boardRef = useRef<TacticsBoard | null>(null)
  boardRef.current = board

  const settings = useLiveQuery(() => db.settings.get('app'), [])
  const fieldColors: FieldColors = settings?.fieldColors ?? DEFAULT_FIELD_COLORS

  const [curStep, setCurStep] = useState(0)
  const curStepRef = useRef(0)
  curStepRef.current = curStep

  const [playing, setPlaying] = useState(false)
  const [stepMode, setStepMode] = useState(0) // reduzierte Bewegung: manueller Fortschritt
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [toolsOpen, setToolsOpen] = useState(false)
  const [ghost, setGhostState] = useState<{ kind: MaterialKind; x: number; y: number } | null>(null)
  const [sheetView, setSheetView] = useState<'boards' | 'new' | 'farben' | 'bibliothek' | 'teilen' | null>(null)
  const [libQuery, setLibQuery] = useState('')
  const [libCat, setLibCat] = useState<LibraryCategory | null>(null)
  const [shareMsg, setShareMsg] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [importOffer, setImportOffer] = useState<TacticsBoard | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const [presetDesc, setPresetDesc] = useState<string | null>(null)
  const [deleteArmed, setDeleteArmed] = useState(false)
  const [present, setPresent] = useState(false)
  const [popover, setPopover] = useState<{
    kind: 'token' | 'material'
    id: string
    title: string
    x: number
    y: number
    below: boolean
  } | null>(null)

  /* ---- 3D-Diorama ---- */
  const [view3d, setView3d] = useState(false)
  const [orbit, setOrbit] = useState({ rx: 52, rz: 0, zoom: 1 })
  const orbitRef = useRef(orbit)
  orbitRef.current = orbit
  const orbitPtrs = useRef(new Map<number, { x: number; y: number }>())
  const pinchStart = useRef<{ dist: number; zoom: number } | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const tokenEls = useRef(new Map<string, SVGGElement>())
  const token3dEls = useRef(new Map<string, { chip?: HTMLDivElement | null; shadow?: HTMLDivElement | null }>())

  /* Board-Kachel messen, damit die 3D-Ebene exakt das ViewBox-Seitenverhältnis bekommt */
  const [boardBox, setBoardBox] = useState<HTMLDivElement | null>(null)
  const [boxSize, setBoxSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    if (!boardBox) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setBoxSize((s) => (s.w === r.width && s.h === r.height ? s : { w: r.width, h: r.height }))
    })
    ro.observe(boardBox)
    return () => ro.disconnect()
  }, [boardBox])

  const skipPersistRef = useRef(true)
  const pendingPersistRef = useRef(false)
  const ghostRef = useRef<typeof ghost>(null)
  const matDragRef = useRef<{
    kind: MaterialKind
    pointerId: number
    startClientX: number
    startClientY: number
    moved: boolean
  } | null>(null)

  const reducedMotion = useMemo(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  /* ---- Laden & Persistenz (debounced ~400 ms) ---- */

  useEffect(() => {
    let alive = true
    void (async () => {
      const latest = await db.boards.orderBy('updatedAt').reverse().limit(1).toArray()
      if (!alive) return
      let b = latest[0]
      if (!b) {
        b = buildPresetBoard(PRESETS[0])
        await db.boards.put(b)
        if (!alive) return
        setPresetDesc(PRESETS[0].description)
      }
      skipPersistRef.current = true
      setBoard(ensureSteps(b))
      setCurStep(0)
      // Per Link geteilten Zug erkennen (…#zug=…)
      const shared = await boardFromLocationHash()
      if (alive && shared) setImportOffer(shared)
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!board) return
    if (skipPersistRef.current) {
      skipPersistRef.current = false
      return
    }
    pendingPersistRef.current = true
    const timer = window.setTimeout(() => {
      pendingPersistRef.current = false
      void db.boards.put({ ...board, updatedAt: new Date().toISOString() })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [board])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (pendingPersistRef.current && boardRef.current) {
        void db.boards.put({ ...boardRef.current, updatedAt: new Date().toISOString() })
      }
    },
    [],
  )

  /* ---- Anzeige-Helfer (Animation läuft direkt am DOM) ---- */

  const registerTokenEl = useCallback(
    (id: string) => (el: SVGGElement | null) => {
      if (el) tokenEls.current.set(id, el)
      else tokenEls.current.delete(id)
    },
    [],
  )

  const register3d = useCallback(
    (id: string, part: 'chip' | 'shadow') => (el: HTMLDivElement | null) => {
      const m = token3dEls.current
      const next = { ...(m.get(id) ?? {}), [part]: el }
      if (!next.chip && !next.shadow) m.delete(id)
      else m.set(id, next)
    },
    [],
  )

  const setTokenTransform = useCallback((id: string, x: number, y: number) => {
    tokenEls.current
      .get(id)
      ?.setAttribute('transform', `translate(${(x * FIELD_W).toFixed(2)} ${(y * FIELD_H).toFixed(2)})`)
    const t3 = token3dEls.current.get(id)
    if (t3?.chip || t3?.shadow) {
      const vbH = (boardRef.current?.field ?? 'half') === 'half' ? VIEW_H_HALF : VIEW_H_FULL
      const left = `${(((x * FIELD_W + VIEW_PAD_X) / VIEW_W) * 100).toFixed(3)}%`
      const top = `${(((y * FIELD_H + VIEW_PAD_Y) / vbH) * 100).toFixed(3)}%`
      if (t3.chip) {
        t3.chip.style.left = left
        t3.chip.style.top = top
        t3.chip.style.transition = 'none'
      }
      if (t3.shadow) {
        t3.shadow.style.left = left
        t3.shadow.style.top = top
        t3.shadow.style.transition = 'none'
      }
    }
  }, [])

  const stopPlay = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setPlaying(false)
  }, [])

  /* ---- Schritte ---- */

  const steps = board?.steps ?? []

  /** Board-Zustand auf Schritt k stellen (Figuren-Positionen aktualisieren). */
  const applyStep = useCallback(
    (k: number) => {
      stopPlay()
      setStepMode(0)
      setPopover(null)
      setCurStep(k)
      setBoard((b) => {
        if (!b) return b
        return {
          ...b,
          tokens: b.tokens.map((t) => {
            const p = positionInStep(b.steps, k, t.id, { x: t.x, y: t.y })
            return { ...t, x: p.x, y: p.y }
          }),
        }
      })
    },
    [stopPlay],
  )

  const addStep = () => {
    const b = boardRef.current
    if (!b) return
    const last = b.steps.length - 1
    const eff: StepPositions = {}
    for (const t of b.tokens) eff[t.id] = positionInStep(b.steps, last, t.id, { x: t.x, y: t.y })
    stopPlay()
    setStepMode(0)
    setDeleteArmed(false)
    setBoard((prev) => (prev ? { ...prev, steps: [...prev.steps, { ...eff }] } : prev))
    // In den neuen Schritt springen (Positionen = geklonter letzter Schritt)
    setCurStep(b.steps.length)
    setBoard((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        tokens: prev.tokens.map((t) => {
          const p = eff[t.id] ?? { x: t.x, y: t.y }
          return { ...t, x: p.x, y: p.y }
        }),
      }
    })
  }

  const deleteCurrentStep = () => {
    const b = boardRef.current
    if (!b || b.steps.length <= 1) return
    const k = curStepRef.current
    const newSteps = b.steps.filter((_, i) => i !== k)
    const newCur = Math.min(k, newSteps.length - 1)
    stopPlay()
    setDeleteArmed(false)
    setCurStep(newCur)
    setBoard((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        steps: newSteps,
        tokens: prev.tokens.map((t) => {
          const p = positionInStep(newSteps, newCur, t.id, { x: t.x, y: t.y })
          return { ...t, x: p.x, y: p.y }
        }),
      }
    })
  }

  /* ---- Abspielen: Bewegung zwischen den Schritten wird interpoliert ---- */

  const seek = useCallback(
    (u: number) => {
      const b = boardRef.current
      if (!b) return
      const pos = positionsAtProgress(b.steps, u)
      for (const t of b.tokens) {
        const p = pos[t.id]
        if (p) setTokenTransform(t.id, p.x, p.y)
      }
    },
    [setTokenTransform],
  )

  const onPlayPress = () => {
    const b = boardRef.current
    if (!b || b.steps.length < 2) return
    setPopover(null)
    setSelectedId(null)
    if (playing) {
      // Stopp: Abspielen abbrechen, zurück in die Grundstellung
      stopPlay()
      applyStep(0)
      return
    }
    if (reducedMotion) {
      // Reduzierte Bewegung: Schritt für Schritt springen statt animieren
      const next = stepMode >= b.steps.length - 1 ? 0 : stepMode + 1
      setStepMode(next)
      applyStep(next)
      return
    }
    stopPlay()
    applyStep(0)
    const dur = (b.steps.length - 1) * SEGMENT_MS
    setPlaying(true)
    const t0 = performance.now()
    const frame = (now: number) => {
      const u = Math.min(1, (now - t0) / dur)
      seek(u)
      if (u < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rafRef.current = null
        setPlaying(false)
        applyStep(b.steps.length - 1)
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  /* ---- Board-Mutationen ---- */

  const moveToken = useCallback((id: string, x: number, y: number) => {
    setBoard((b) =>
      b ? { ...b, tokens: b.tokens.map((t) => (t.id === id ? { ...t, x, y } : t)) } : b,
    )
  }, [])

  const moveMaterial = useCallback((id: string, x: number, y: number) => {
    setBoard((b) =>
      b ? { ...b, materials: b.materials.map((m) => (m.id === id ? { ...m, x, y } : m)) } : b,
    )
  }, [])

  /** Nach dem Loslassen: Position der Figur in den aktuellen Schritt schreiben. */
  const onTokenDropped = useCallback((id: string) => {
    setBoard((b) => {
      if (!b) return b
      const t = b.tokens.find((x) => x.id === id)
      if (!t) return b
      const k = curStepRef.current
      const steps = b.steps.map((s, i) => (i === k ? { ...s, [id]: { x: t.x, y: t.y } } : s))
      return { ...b, steps }
    })
  }, [])

  const openPopover = (kind: 'token' | 'material', id: string, clientX: number, clientY: number) => {
    const b = boardRef.current
    if (!b) return
    let title: string
    if (kind === 'token') {
      const t = b.tokens.find((x) => x.id === id)
      if (!t) return
      title =
        t.kind === 'ball' ? 'Ball' : t.kind === 'opp' ? `Abwehr ${t.label ?? ''}`.trim() : (t.label ?? 'Spielerin')
      setSelectedId(id)
    } else {
      const m = b.materials.find((x) => x.id === id)
      if (!m) return
      title = MATERIAL_LABEL[m.kind]
      setSelectedId(null)
    }
    setPopover({
      kind,
      id,
      title,
      x: Math.min(window.innerWidth - 100, Math.max(100, clientX)),
      y: clientY,
      below: clientY < 170,
    })
  }

  const onPopoverDelete = () => {
    const p = popover
    if (!p) return
    setPopover(null)
    if (p.kind === 'token') {
      setSelectedId(null)
      setBoard((b) => {
        if (!b) return b
        return {
          ...b,
          tokens: b.tokens.filter((t) => t.id !== p.id),
          steps: b.steps.map((s) => {
            const rest = { ...s }
            delete rest[p.id]
            return rest
          }),
        }
      })
    } else {
      setBoard((b) => (b ? { ...b, materials: b.materials.filter((m) => m.id !== p.id) } : b))
    }
  }

  const dragHandlers = useBoardDrag({
    field: board?.field ?? 'half',
    disabled: playing || view3d,
    getToken: (id) => boardRef.current?.tokens.find((t) => t.id === id),
    getMaterial: (id) => boardRef.current?.materials.find((m) => m.id === id),
    moveToken,
    moveMaterial,
    onTokenDropped,
    onTapToken: (id, cx, cy) => openPopover('token', id, cx, cy),
    onTapMaterial: (id, cx, cy) => openPopover('material', id, cx, cy),
    onTapBackground: () => {
      setPopover(null)
      setSelectedId(null)
    },
    onDragStart: () => setPopover(null),
  })

  /* ---- Feld / Abwehr / Figuren ---- */

  const hasOpp = board?.tokens.some((t) => t.kind === 'opp') ?? false
  const hasBall = board?.tokens.some((t) => t.kind === 'ball') ?? false

  const toggleDefense = () => {
    stopPlay()
    setToolsOpen(false)
    setBoard((b) => {
      if (!b) return b
      if (b.tokens.some((t) => t.kind === 'opp')) {
        const oppIds = new Set(b.tokens.filter((t) => t.kind === 'opp').map((t) => t.id))
        return {
          ...b,
          tokens: b.tokens.filter((t) => !oppIds.has(t.id)),
          steps: b.steps.map((s) => {
            const rest = { ...s }
            for (const id of oppIds) delete rest[id]
            return rest
          }),
        }
      }
      const opp = oppDefenseTokens()
      const base = { ...b.steps[0] }
      for (const t of opp) base[t.id] = { x: t.x, y: t.y }
      return {
        ...b,
        tokens: [...b.tokens, ...opp],
        steps: b.steps.map((s, i) => (i === 0 ? base : s)),
      }
    })
  }

  const setField = (f: 'full' | 'half') => {
    stopPlay()
    setBoard((b) => {
      if (!b || b.field === f) return b
      if (f === 'full') return { ...b, field: f }
      // Halbfeld: alles in die sichtbare Angriffshälfte holen (auch in den Schritten)
      const maxY = (FIELD_H / 2 - 0.6) / FIELD_H
      const clampY = (y: number) => Math.min(y, maxY)
      return {
        ...b,
        field: f,
        tokens: b.tokens.map((t) => ({ ...t, y: clampY(t.y) })),
        materials: b.materials.map((m) => ({ ...m, y: clampY(m.y) })),
        steps: b.steps.map((s) => {
          const out: StepPositions = {}
          for (const [id, p] of Object.entries(s)) out[id] = { x: p.x, y: clampY(p.y) }
          return out
        }),
      }
    })
  }

  /** Figur ergänzen — landet in der Grundstellung (Schritt 1) und gilt fortan. */
  const addFigure = (kind: 'own' | 'opp' | 'ball') => {
    setToolsOpen(false)
    setBoard((b) => {
      if (!b) return b
      if (kind === 'ball' && b.tokens.some((t) => t.kind === 'ball')) return b
      let label: string | undefined
      if (kind === 'own') {
        const used = new Set(b.tokens.filter((t) => t.kind === 'own').map((t) => t.label))
        label =
          ['TW', 'LA', 'RA', 'KM', 'RL', 'RM', 'RR'].find((p) => !used.has(p)) ??
          `S${b.tokens.filter((t) => t.kind === 'own').length + 1}`
      } else if (kind === 'opp') {
        label = String(b.tokens.filter((t) => t.kind === 'opp').length + 1)
      }
      const n = b.tokens.length
      const pos = {
        x: Math.min(0.9, Math.max(0.1, 0.5 + ((n % 5) - 2) * 0.09)),
        y: b.field === 'half' ? 0.4 : 0.58,
      }
      const tokenId = uid()
      return {
        ...b,
        tokens: [...b.tokens, { id: tokenId, kind, label, ...pos }],
        steps: b.steps.map((s, i) => (i === 0 ? { ...s, [tokenId]: pos } : s)),
      }
    })
  }

  const resetTransient = useCallback(() => {
    stopPlay()
    setStepMode(0)
    setSelectedId(null)
    setPopover(null)
    setDeleteArmed(false)
  }, [stopPlay])

  const loadBoard = (id: string) => {
    void (async () => {
      const b = await db.boards.get(id)
      if (!b) return
      skipPersistRef.current = true
      setBoard(ensureSteps(b))
      setCurStep(0)
      resetTransient()
      setPresetDesc(null)
      setSheetView(null)
    })()
  }

  const createBoard = (kind: NewBoardKind) => {
    void (async () => {
      const nb = makeNewBoard(kind)
      await db.boards.put(nb)
      skipPersistRef.current = true
      setBoard(nb)
      setCurStep(0)
      resetTransient()
      setPresetDesc(null)
      setSheetView(null)
    })()
  }

  const loadLibraryEntry = (entry: LibraryEntry) => {
    void (async () => {
      const nb = buildLibraryBoard(entry)
      await db.boards.put(nb)
      skipPersistRef.current = true
      setBoard(nb)
      setCurStep(0)
      resetTransient()
      setPresetDesc(entry.description)
      setSheetView(null)
    })()
  }

  const renameBoard = (id: string, title: string) => {
    void db.boards.update(id, { title, updatedAt: new Date().toISOString() })
    if (boardRef.current?.id === id) {
      skipPersistRef.current = true
      setBoard((b) => (b ? { ...b, title } : b))
    }
  }

  const deleteBoard = (id: string) => {
    void (async () => {
      await db.boards.delete(id)
      if (boardRef.current?.id !== id) return
      const rest = await db.boards.orderBy('updatedAt').reverse().limit(1).toArray()
      let nb = rest[0]
      if (!nb) {
        nb = makeNewBoard('leer')
        await db.boards.put(nb)
      }
      skipPersistRef.current = true
      setBoard(ensureSteps(nb))
      setCurStep(0)
      resetTransient()
      setPresetDesc(null)
    })()
  }

  /* ---- Material aus der Ablage aufs Feld ziehen ---- */

  const setGhost = (g: { kind: MaterialKind; x: number; y: number } | null) => {
    ghostRef.current = g
    setGhostState(g)
  }

  const addMaterial = (kind: MaterialKind, x: number, y: number) => {
    setBoard((b) => (b ? { ...b, materials: [...b.materials, { id: uid(), kind, x, y }] } : b))
  }

  const matPointerDown = (kind: MaterialKind) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    matDragRef.current = {
      kind,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* unkritisch */
    }
  }

  const matPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = matDragRef.current
    const svg = svgRef.current
    if (!d || e.pointerId !== d.pointerId || !svg) return
    if (Math.abs(e.clientX - d.startClientX) + Math.abs(e.clientY - d.startClientY) > 6) {
      if (!d.moved) setToolsOpen(false) // Seitenleiste weg, damit das Feld frei ist
      d.moved = true
    }
    if (!d.moved) return
    const fieldMode = boardRef.current?.field ?? 'half'
    const raw = svgPointNorm(svg, e.clientX, e.clientY)
    const inCourt =
      raw.x > -0.06 && raw.x < 1.06 && raw.y > -0.05 && raw.y < (fieldMode === 'half' ? 0.55 : 1.05)
    setGhost(inCourt ? { kind: d.kind, ...clampNorm(raw, fieldMode) } : null)
  }

  const matPointerEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = matDragRef.current
    if (!d || e.pointerId !== d.pointerId) return
    matDragRef.current = null
    const g = ghostRef.current
    setGhost(null)
    if (e.type === 'pointercancel') return
    setToolsOpen(false)
    if (g) {
      addMaterial(g.kind, g.x, g.y)
    } else if (!d.moved) {
      const b = boardRef.current
      const n = b?.materials.length ?? 0
      const fieldMode = b?.field ?? 'half'
      const p = clampNorm(
        {
          x: 0.5 + ((n % 3) - 1) * 0.13,
          y: (fieldMode === 'half' ? 0.3 : 0.5) + ((Math.floor(n / 3) % 3) - 1) * 0.055,
        },
        fieldMode,
      )
      addMaterial(d.kind, p.x, p.y)
    }
  }

  /* ---- 3D-Orbit-Gesten ---- */

  const orbitDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    orbitPtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (orbitPtrs.current.size === 2) {
      const [a, b] = [...orbitPtrs.current.values()]
      pinchStart.current = { dist: Math.hypot(b.x - a.x, b.y - a.y), zoom: orbitRef.current.zoom }
    }
  }

  const orbitMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const prev = orbitPtrs.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    orbitPtrs.current.set(e.pointerId, cur)
    if (orbitPtrs.current.size === 2 && pinchStart.current) {
      const [a, b] = [...orbitPtrs.current.values()]
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const zoom = Math.min(2.4, Math.max(0.6, (pinchStart.current.zoom * dist) / pinchStart.current.dist))
      setOrbit((o) => ({ ...o, zoom }))
      return
    }
    const dx = cur.x - prev.x
    const dy = cur.y - prev.y
    setOrbit((o) => ({
      rx: Math.min(85, Math.max(8, o.rx - dy * 0.3)),
      rz: o.rz + dx * 0.4,
      zoom: o.zoom,
    }))
  }

  const orbitEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    orbitPtrs.current.delete(e.pointerId)
    if (orbitPtrs.current.size < 2) pinchStart.current = null
  }


  /* ---- Teilen ---- */

  const acceptImport = (b: TacticsBoard) => {
    void (async () => {
      await db.boards.put(b)
      skipPersistRef.current = true
      setBoard(b)
      setCurStep(0)
      resetTransient()
      setPresetDesc(null)
      setImportOffer(null)
      setSheetView(null)
      clearShareHash()
    })()
  }

  const shareLink = async () => {
    const b = boardRef.current
    if (!b) return
    setShareBusy(true)
    setShareMsg(null)
    try {
      const url = await boardToShareUrl(b)
      if (navigator.share) {
        await navigator.share({ title: b.title || 'Spielzug', url })
        setShareMsg('Geteilt. Der komplette Zug steckt im Link — kein Konto nötig.')
      } else {
        await navigator.clipboard.writeText(url)
        setShareMsg('Link kopiert — einfach in WhatsApp & Co. einfügen.')
      }
    } catch {
      setShareMsg(null)
    } finally {
      setShareBusy(false)
    }
  }

  const shareImage = async () => {
    const b = boardRef.current
    const svg = svgRef.current
    if (!b || !svg) return
    setShareBusy(true)
    setShareMsg(null)
    try {
      // In der 3D-Ansicht sind die SVG-Figuren versteckt — fürs Bild wieder einblenden
      const clone = svg.cloneNode(true) as SVGSVGElement
      clone.querySelectorAll<SVGGElement>('[data-hide3d]').forEach((g) => g.removeAttribute('style'))
      const blob = await boardToPngBlob(clone, fieldColors)
      if (!blob) {
        setShareMsg('Bild konnte nicht erzeugt werden.')
        return
      }
      const file = new File([blob], `${b.title || 'spielzug'}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: b.title || 'Spielzug' })
        setShareMsg('Bild geteilt.')
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = file.name
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 5000)
        setShareMsg('Bild heruntergeladen.')
      }
    } catch {
      setShareMsg(null)
    } finally {
      setShareBusy(false)
    }
  }

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    const b = await boardFromFile(file)
    if (b) setImportOffer(b)
    else setShareMsg('Datei konnte nicht gelesen werden — ist es eine .taktik.json?')
  }

  /* ---- Render ---- */

  if (!board) {
    return (
      <div className="flex h-[50dvh] items-center justify-center font-display uppercase tracking-wide text-muted">
        Lädt …
      </div>
    )
  }

  const hint = view3d ? HINT_3D : (presetDesc ?? HINT_DEFAULT)
  const playLabel = reducedMotion
    ? stepMode === 0
      ? 'Schritt'
      : `Schritt ${stepMode + 1}/${steps.length}`
    : playing
      ? 'Stopp'
      : 'Abspielen'

  // Pfeile: aktueller Schritt → nächster Schritt (nicht während des Abspielens)
  const arrows: CourtArrow[] =
    !playing && curStep < steps.length - 1
      ? stepArrows(steps[curStep], steps[curStep + 1]).map((a) => ({
          ...a,
          isBall: board.tokens.find((t) => t.id === a.id)?.kind === 'ball',
        }))
      : []

  const courtVars = {
    '--court': fieldColors.court,
    '--court-area': fieldColors.area,
    '--court-lines': fieldColors.lines,
  } as CSSProperties

  // Feld-Ebene exakt im ViewBox-Seitenverhältnis — nötig, damit die
  // 3D-Aufsteller (HTML-Overlay) deckungsgleich auf dem SVG-Feld stehen.
  const vbH = board.field === 'half' ? VIEW_H_HALF : VIEW_H_FULL
  const planeW = boxSize.w > 0 ? Math.min(boxSize.w, (boxSize.h * VIEW_W) / vbH) : 0
  const planeH = planeW > 0 ? (planeW * vbH) / VIEW_W : 0
  const chipPx = planeW * (2.24 / VIEW_W)
  const ballPx = planeW * (1.3 / VIEW_W)
  const slabT = Math.min(22, Math.max(10, planeW * 0.05))
  const orbitActive = orbitPtrs.current.size > 0

  const boardArea = (
    <div
      ref={setBoardBox}
      className={`relative overflow-hidden rounded-2xl shadow-card ${present ? 'flex-1' : ''}`}
      style={{
        ...courtVars,
        background: `color-mix(in srgb, ${fieldColors.court} 55%, #0e1116)`,
        ...(present
          ? {}
          : {
              // 3D hat weniger UI drumherum — das Diorama bekommt mehr Höhe
              height: view3d ? 'calc(100dvh - 304px)' : 'calc(100dvh - 356px)',
              minHeight: 300,
              maxHeight: 720,
            }),
      }}
    >
      {/* Perspektiv-Bühne fürs Diorama */}
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ perspective: view3d ? '1100px' : undefined }}
      >
        <div
          className="relative"
          style={{
            width: planeW > 0 ? planeW : '100%',
            height: planeH > 0 ? planeH : '100%',
            transform: view3d
              ? `scale(${orbit.zoom}) rotateX(${orbit.rx}deg) rotateZ(${orbit.rz}deg)`
              : undefined,
            transformStyle: view3d ? 'preserve-3d' : undefined,
            transition: orbitActive ? undefined : 'transform 320ms ease',
          }}
        >
          <Court
            field={board.field}
            tokens={board.tokens}
            materials={board.materials}
            arrows={arrows}
            selectedId={selectedId}
            ghost={ghost}
            svgRef={svgRef}
            registerTokenEl={registerTokenEl}
            hideFigures={view3d}
            {...dragHandlers}
          />
          {view3d && planeW > 0 && <Slab w={planeW} h={planeH} t={slabT} court={fieldColors.court} />}
          {view3d && planeW > 0 && (
            <Layer3D
              tokens={board.tokens}
              materials={board.materials}
              field={board.field}
              rx={orbit.rx}
              rz={orbit.rz}
              animate={!orbitActive}
              chipPx={chipPx}
              ballPx={ballPx}
              register={register3d}
            />
          )}
        </div>
      </div>
      {/* Orbit-Fläche über dem Feld (nur 3D) */}
      {view3d && (
        <div
          className="absolute inset-0"
          role="application"
          aria-label="3D-Ansicht — Ziehen dreht das Feld, Kneifen zoomt"
          style={{ touchAction: 'none', cursor: 'grab' }}
          onPointerDown={orbitDown}
          onPointerMove={orbitMove}
          onPointerUp={orbitEnd}
          onPointerCancel={orbitEnd}
          onWheel={(e) => {
            setOrbit((o) => ({
              ...o,
              zoom: Math.min(2.4, Math.max(0.6, o.zoom * (e.deltaY > 0 ? 0.92 : 1.08))),
            }))
          }}
        />
      )}
      {/* Overlay-Knöpfe */}
      <div className="absolute right-2 top-2 flex gap-1.5">
        {view3d && (
          <button
            aria-label="3D-Ansicht zurücksetzen"
            onClick={() => setOrbit({ rx: 52, rz: 0, zoom: 1 })}
            className="grid h-11 w-11 place-items-center rounded-xl bg-black/45 text-white active:bg-black/60"
          >
            <Icon d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3M4.5 13.5v-4h4" className="h-5 w-5" />
          </button>
        )}
        <button
          aria-label={present ? 'Vollbild beenden' : 'Vollbild — Board groß zeigen'}
          onClick={() => setPresent((v) => !v)}
          className="grid h-11 w-11 place-items-center rounded-xl bg-black/45 text-white active:bg-black/60"
        >
          <Icon d={present ? IC_CLOSE : IC_EXPAND} className="h-5 w-5" />
        </button>
      </div>
    </div>
  )

  const stepBar = (
    <div className="mt-2 flex items-center gap-2">
      <div
        className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5"
        role="group"
        aria-label="Schritte des Spielzugs"
      >
        {steps.map((_, i) => (
          <button
            key={i}
            aria-label={`Schritt ${i + 1}${i === curStep ? ' (aktiv)' : ''}`}
            aria-current={i === curStep ? 'step' : undefined}
            onClick={() => applyStep(i)}
            className={`min-h-11 min-w-11 flex-none rounded-full font-display text-[14px] font-bold ${
              i === curStep
                ? 'bg-btn-bg text-btn-ink'
                : 'border border-line bg-card text-ink'
            }`}
          >
            {i + 1}
          </button>
        ))}
        {!view3d && (
          <button
            aria-label="Neuen Schritt hinzufügen"
            onClick={addStep}
            className="grid h-11 w-11 flex-none place-items-center rounded-full border border-dashed border-accent text-accent active:bg-accent-soft"
          >
            <Icon d={IC_PLUS} className="h-4 w-4" />
          </button>
        )}
        {!view3d && steps.length > 1 && (
          <button
            aria-label={deleteArmed ? `Schritt ${curStep + 1} wirklich löschen` : `Schritt ${curStep + 1} löschen`}
            onClick={() => {
              if (deleteArmed) deleteCurrentStep()
              else setDeleteArmed(true)
            }}
            onBlur={() => setDeleteArmed(false)}
            className={`inline-flex min-h-11 min-w-11 flex-none items-center justify-center gap-1 rounded-full px-3 text-[12px] font-semibold ${
              deleteArmed ? 'bg-crit text-white' : 'border border-line text-muted'
            }`}
          >
            <Icon d={IC_TRASH} className="h-4 w-4" />
            {deleteArmed ? 'Wirklich?' : ''}
          </button>
        )}
      </div>
      <Button
        onClick={onPlayPress}
        disabled={steps.length < 2}
        className="flex-none px-3"
        aria-label={
          playing
            ? 'Abspielen stoppen'
            : 'Spielzug abspielen — Bewegung zwischen den Schritten wird automatisch ergänzt'
        }
      >
        <Icon d={playing ? IC_STOP : IC_PLAY} className="h-4 w-4" />
        {playLabel}
      </Button>
    </div>
  )

  return (
    <div className={present ? undefined : 'flex flex-col'}>
      {/* Kopfzeile: Titel (inline editierbar) + Meine Züge */}
      {!present && !view3d && (
        <div className="flex items-center gap-2">
          <input
            value={board.title}
            onChange={(e) => setBoard((b) => (b ? { ...b, title: e.target.value } : b))}
            aria-label="Name des Spielzugs — antippen zum Umbenennen"
            placeholder="Name des Spielzugs"
            className="min-h-11 min-w-0 flex-1 border-b border-dashed border-muted/60 bg-transparent font-display text-[18px] font-bold uppercase tracking-wide text-ink outline-none focus:border-accent"
          />
          <button
            onClick={() => setSheetView('boards')}
            className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-xl bg-accent-soft px-3 font-display text-[12px] font-bold uppercase tracking-wide text-accent active:opacity-80"
          >
            <Icon d={IC_BOOKMARK} className="h-4 w-4" />
            Meine Züge
          </button>
        </div>
      )}

      {/* 3D: reduzierte Leiste — nur zurück zum Bearbeiten + Titel */}
      {!present && view3d && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView3d(false)}
            className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-xl bg-accent-soft px-3 font-display text-[12px] font-bold uppercase tracking-wide text-accent active:opacity-80"
          >
            <Icon d={IC_CUBE} className="h-4 w-4" />
            2D · Bearbeiten
          </button>
          <p className="min-w-0 flex-1 truncate text-right font-display text-[14px] font-bold uppercase tracking-wide text-muted">
            {board.title || 'Spielzug'}
          </p>
        </div>
      )}

      {/* Werkzeugleiste: Feldwahl + 3D links, Werkzeuge-Panel rechts */}
      {!present && !view3d && (
        <div className="mt-2 flex items-center gap-2">
          <div className="w-30 flex-none">
            <Segmented<'full' | 'half'>
              options={[
                { value: 'full', label: 'Ganz' },
                { value: 'half', label: 'Halb' },
              ]}
              value={board.field}
              onChange={setField}
            />
          </div>
          <Chip
            pressed={view3d}
            onClick={() => {
              setToolsOpen(false)
              setPopover(null)
              setSelectedId(null)
              setView3d((v) => !v)
            }}
            ariaLabel="3D-Diorama-Ansicht umschalten"
          >
            <Icon d={IC_CUBE} /> {view3d ? '2D' : '3D'}
          </Chip>
          <div className="min-w-0 flex-1" />
          <button
            onClick={() => setToolsOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={toolsOpen}
            className="inline-flex min-h-11 flex-none items-center gap-1.5 rounded-xl bg-accent-soft px-3 font-display text-[12px] font-bold uppercase tracking-wide text-accent active:opacity-80"
          >
            <Icon d={IC_TOOLS} className="h-4 w-4" />
            Werkzeuge
          </button>
        </div>
      )}

      {/* Feld + Schrittleiste — normal oder als Vollbild-Präsentation */}
      {present ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="mb-2 truncate px-1 font-display text-[16px] font-bold uppercase tracking-wide text-ink">
            {board.title || 'Spielzug'}
          </p>
          {boardArea}
          {stepBar}
        </div>
      ) : (
        <>
          <div className="mt-2" />
          {boardArea}
          {stepBar}
          <p className="mt-1.5 px-1 text-[11.5px] leading-snug text-muted">{hint}</p>
        </>
      )}

      {/* Popover: Figur / Material entfernen */}
      {popover && (
        <>
          <button
            aria-label="Popover schließen"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setPopover(null)}
          />
          <div
            role="dialog"
            aria-label={popover.title}
            className="fixed z-50 w-44 rounded-xl border border-line bg-card p-1.5 shadow-card"
            style={{
              left: popover.x,
              top: popover.y,
              transform: popover.below ? 'translate(-50%, 16px)' : 'translate(-50%, calc(-100% - 16px))',
            }}
          >
            <p className="truncate px-2 py-1 text-[11px] font-semibold text-muted">{popover.title}</p>
            <button
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-crit active:bg-crit-soft"
              onClick={onPopoverDelete}
            >
              <Icon d={IC_TRASH} className="h-4 w-4" />
              Vom Feld entfernen
            </button>
          </div>
        </>
      )}

      {/* Werkzeuge-Seitenleiste (Overlay von rechts) */}
      <button
        aria-label="Werkzeuge schließen"
        tabIndex={toolsOpen ? 0 : -1}
        onClick={() => setToolsOpen(false)}
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-200 ${
          toolsOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />
      {/* Mobil: halbhohes Bottom-Sheet (Feld bleibt sichtbar zum Reinziehen) — ab lg: Seitenleiste rechts */}
      <aside
        role="dialog"
        aria-label="Werkzeuge"
        inert={!toolsOpen}
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[54dvh] flex-col gap-4 overflow-y-auto rounded-t-3xl border-t border-line bg-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-card transition-transform duration-200 lg:inset-x-auto lg:right-0 lg:top-0 lg:max-h-none lg:w-[300px] lg:rounded-none lg:border-l lg:border-t-0 lg:pt-[max(1rem,env(safe-area-inset-top))] ${
          toolsOpen
            ? 'translate-x-0 translate-y-0'
            : 'translate-y-full lg:translate-x-full lg:translate-y-0'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[15px] font-bold uppercase tracking-wide text-ink">Werkzeuge</h2>
          <button
            aria-label="Werkzeuge schließen"
            onClick={() => setToolsOpen(false)}
            className="grid h-11 w-11 place-items-center rounded-xl text-muted active:bg-card-2"
          >
            <Icon d={IC_CLOSE} className="h-5 w-5" />
          </button>
        </div>

        <div>
          <p className="mb-1.5 px-1 font-display text-[11px] font-bold uppercase tracking-wide text-muted">
            Figuren aufs Feld
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => addFigure('own')}
              className="flex flex-col items-center gap-1 rounded-xl border border-line bg-card px-1 py-2.5 active:border-accent"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="#ffffff" stroke="var(--club-700)" strokeWidth="2.4" />
              </svg>
              <span className="text-[11px] font-semibold text-ink">Spielerin</span>
            </button>
            <button
              onClick={() => addFigure('opp')}
              className="flex flex-col items-center gap-1 rounded-xl border border-line bg-card px-1 py-2.5 active:border-accent"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="#272c35" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" />
              </svg>
              <span className="text-[11px] font-semibold text-ink">Abwehr</span>
            </button>
            <button
              onClick={() => addFigure('ball')}
              disabled={hasBall}
              className="flex flex-col items-center gap-1 rounded-xl border border-line bg-card px-1 py-2.5 active:border-accent disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
                <circle cx="12" cy="12" r="7.5" fill="var(--club-acc)" stroke="var(--club-acc-ink)" strokeWidth="1" />
              </svg>
              <span className="text-[11px] font-semibold text-ink">Ball</span>
            </button>
          </div>
          <button
            onClick={toggleDefense}
            aria-pressed={hasOpp}
            className={`mt-1.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold ${
              hasOpp ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-card text-ink'
            }`}
          >
            <Icon d={IC_SHIELD} className="h-4 w-4" />
            {hasOpp ? 'Abwehr 6:0 entfernen' : 'Abwehr 6:0 aufstellen'}
          </button>
        </div>

        <div>
          <p className="mb-1.5 px-1 font-display text-[11px] font-bold uppercase tracking-wide text-muted">
            Material — antippen oder aufs Feld ziehen
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {MATERIAL_KINDS.map((k) => (
              <button
                key={k}
                onPointerDown={matPointerDown(k)}
                onPointerMove={matPointerMove}
                onPointerUp={matPointerEnd}
                onPointerCancel={matPointerEnd}
                style={{ touchAction: 'none' }}
                className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border border-line bg-card px-1 py-1.5 text-[10px] font-semibold text-muted active:border-accent"
              >
                <svg viewBox="-2 -2 4 4" className="h-6 w-6" aria-hidden="true">
                  <MatGlyph kind={k} />
                </svg>
                {MATERIAL_LABEL[k]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 px-1 font-display text-[11px] font-bold uppercase tracking-wide text-muted">Mehr</p>
          <div className="flex flex-col gap-1.5">
            {(
              [
                [IC_BOOK, 'Bibliothek', () => setSheetView('bibliothek')],
                [IC_SHARE, 'Teilen', () => { setShareMsg(null); setSheetView('teilen') }],
                [IC_PALETTE, 'Feldfarben', () => setSheetView('farben')],
                [IC_PLUS, 'Neuer Zug', () => setSheetView('new')],
              ] as [string, string, () => void][]
            ).map(([d, label, action]) => (
              <button
                key={label}
                onClick={() => {
                  setToolsOpen(false)
                  action()
                }}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-card px-3 text-left text-[13px] font-semibold text-ink active:border-accent"
              >
                <Icon d={d} className="h-4.5 w-4.5 text-accent" />
                <span className="flex-1">{label}</span>
                <Icon d={IC_CHEV} className="h-4 w-4 text-muted" />
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Sheets */}
      <BoardsSheet
        open={sheetView === 'boards'}
        onClose={() => setSheetView(null)}
        currentId={board.id}
        onLoad={loadBoard}
        onRename={renameBoard}
        onDelete={deleteBoard}
        onNew={() => setSheetView('new')}
      />
      <Sheet open={sheetView === 'teilen'} onClose={() => setSheetView(null)} title="Zug teilen">
        <div className="flex flex-col gap-2">
          <Button onClick={() => void shareLink()} disabled={shareBusy}>
            <Icon d={IC_SHARE} className="h-4 w-4" /> Link teilen (WhatsApp & Co.)
          </Button>
          <p className="-mt-1 px-1 text-[11.5px] text-muted">
            Der komplette Spielzug steckt im Link — wer ihn öffnet, kann ihn direkt
            übernehmen und weiterbearbeiten.
          </p>
          <Button variant="secondary" onClick={() => void shareImage()} disabled={shareBusy}>
            Als Bild teilen / speichern
          </Button>
          <div className="mt-1 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => boardRef.current && downloadBoardFile(boardRef.current)}
            >
              Datei sichern
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => importFileRef.current?.click()}>
              Datei importieren …
            </Button>
          </div>
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              void onImportFile(f)
            }}
          />
          {shareMsg && <p className="px-1 text-[12px] font-semibold text-ok">{shareMsg}</p>}
        </div>
      </Sheet>
      <Sheet open={importOffer !== null} onClose={() => { setImportOffer(null); clearShareHash() }} title="Geteilten Zug übernehmen?">
        {importOffer && (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] text-ink">
              <span className="font-display font-bold uppercase tracking-wide">{importOffer.title || 'Ohne Titel'}</span>
              <span className="text-muted">
                {' '}— {importOffer.steps.length} {importOffer.steps.length === 1 ? 'Schritt' : 'Schritte'},{' '}
                {importOffer.tokens.length} Figuren
              </span>
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => acceptImport(importOffer)}>
                Übernehmen
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { setImportOffer(null); clearShareHash() }}
              >
                Verwerfen
              </Button>
            </div>
            <p className="text-[11.5px] text-muted">
              Wird als eigener Zug unter „Meine Züge" gespeichert — dein aktueller Zug bleibt erhalten.
            </p>
          </div>
        )}
      </Sheet>
      <Sheet open={sheetView === 'bibliothek'} onClose={() => setSheetView(null)} title="Bibliothek">
        <div className="flex flex-col gap-2">
          <input
            value={libQuery}
            onChange={(e) => setLibQuery(e.target.value)}
            placeholder="Suchen … z.B. Kreuzung, 6:0, Gegenstoß"
            aria-label="Bibliothek durchsuchen"
            className="min-h-11 w-full rounded-xl border border-line bg-card-2 px-3 text-[14px] text-ink outline-none placeholder:text-muted focus:border-accent"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Nach Kategorie filtern">
            <button
              aria-pressed={libCat === null}
              onClick={() => setLibCat(null)}
              className={`min-h-11 rounded-full px-3 text-[12px] font-semibold ${
                libCat === null ? 'bg-accent text-btn-ink' : 'border border-line text-muted'
              }`}
            >
              Alle
            </button>
            {LIBRARY_CATEGORIES.map((c) => (
              <button
                key={c}
                aria-pressed={libCat === c}
                onClick={() => setLibCat(libCat === c ? null : c)}
                className={`min-h-11 rounded-full px-3 text-[12px] font-semibold ${
                  libCat === c ? 'bg-accent text-btn-ink' : 'border border-line text-muted'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {LIBRARY.filter(
            (e) =>
              (libCat === null || e.kategorie === libCat) &&
              (libQuery.trim() === '' ||
                `${e.title} ${e.description}`.toLowerCase().includes(libQuery.trim().toLowerCase())),
          ).map((e) => (
            <button
              key={e.id}
              onClick={() => loadLibraryEntry(e)}
              className="rounded-xl border border-line bg-card-2 px-3 py-3 text-left active:border-accent"
            >
              <p className="flex items-center gap-2 font-display text-[14px] font-bold uppercase tracking-wide text-ink">
                {e.title}
                <Badge tone="accent">{e.kategorie}</Badge>
                {e.field === 'full' && <Badge tone="neutral">Ganzes Feld</Badge>}
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">{e.description}</p>
            </button>
          ))}
          {LIBRARY.filter(
            (e) =>
              (libCat === null || e.kategorie === libCat) &&
              (libQuery.trim() === '' ||
                `${e.title} ${e.description}`.toLowerCase().includes(libQuery.trim().toLowerCase())),
          ).length === 0 && (
            <p className="py-2 text-center text-[13px] text-muted">
              Nichts gefunden — Suchbegriff oder Filter anpassen.
            </p>
          )}
        </div>
      </Sheet>
      <Sheet open={sheetView === 'farben'} onClose={() => setSheetView(null)} title="Feldfarben">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Farb-Vorlagen">
            {FIELD_COLOR_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => void db.settings.update('app', { fieldColors: p.colors })}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-[12px] font-semibold text-ink active:border-accent"
              >
                <span className="flex h-5 w-8 overflow-hidden rounded" aria-hidden="true">
                  <span className="flex-1" style={{ background: p.colors.court }} />
                  <span className="flex-1" style={{ background: p.colors.area }} />
                </span>
                {p.label}
              </button>
            ))}
          </div>
          {(
            [
              ['court', 'Spielfläche'],
              ['area', 'Torraum'],
              ['lines', 'Linien'],
            ] as [keyof FieldColors, string][]
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-ink">{label}</span>
              <span className="flex items-center gap-2">
                <span className="text-[12px] uppercase tabular-nums text-muted">{fieldColors[key]}</span>
                <input
                  type="color"
                  value={fieldColors[key]}
                  onChange={(e) =>
                    void db.settings.update('app', {
                      fieldColors: { ...fieldColors, [key]: e.target.value },
                    })
                  }
                  aria-label={`Farbe für ${label}`}
                  className="h-11 w-16 cursor-pointer rounded-lg border border-line bg-card-2"
                />
              </span>
            </label>
          ))}
          <p className="text-[11.5px] text-muted">
            Gilt für alle Züge auf diesem Gerät. Vorlagen oben setzen alle drei Farben auf einmal.
          </p>
        </div>
      </Sheet>
      <Sheet open={sheetView === 'new'} onClose={() => setSheetView(null)} title="Neuer Zug">
        <div className="flex flex-col gap-2">
          {NEW_BOARD_OPTIONS.map((o) => (
            <button
              key={o.kind}
              onClick={() => createBoard(o.kind)}
              className="rounded-xl border border-line bg-card-2 px-3 py-3 text-left active:border-accent"
            >
              <p className="font-display text-[14px] font-bold uppercase tracking-wide text-ink">
                {o.title}
              </p>
              <p className="mt-0.5 text-[12px] text-muted">{o.sub}</p>
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

/* ---------- Mini-Vorschau eines Zugs (Thumbnail in "Meine Züge") ---------- */

function BoardThumb({ board }: { board: TacticsBoard }) {
  const half = board.field === 'half'
  const W = 64
  const H = half ? 64 : 96
  const mapX = (x: number) => 4 + x * (W - 8)
  const mapY = (y: number) => 4 + (half ? y / 0.5 : y) * (H - 8)
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Vorschau: ${board.title || 'Ohne Titel'}`}
      className="shrink-0 rounded-lg"
      style={{ background: '#2f6bc4', border: '1px solid rgba(255,255,255,0.25)' }}
    >
      <rect x="4" y="4" width={W - 8} height={H - 8} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
      {!half && <line x1="4" y1={H / 2} x2={W - 4} y2={H / 2} stroke="rgba(255,255,255,0.8)" strokeWidth="1" />}
      <path d={`M ${mapX(0.28)} 4 Q ${W / 2} ${mapY(0.14)} ${mapX(0.72)} 4`} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
      {!half && (
        <path d={`M ${mapX(0.28)} ${H - 4} Q ${W / 2} ${H - (mapY(0.14) - 4)} ${mapX(0.72)} ${H - 4}`} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1" />
      )}
      {board.tokens.map((t) => (
        <circle
          key={t.id}
          cx={mapX(t.x)}
          cy={mapY(Math.min(t.y, half ? 0.5 : 1))}
          r={t.kind === 'ball' ? 2 : 2.6}
          fill={t.kind === 'own' ? '#ffffff' : t.kind === 'ball' ? '#ffc72c' : '#20242c'}
        />
      ))}
      {board.materials.map((m) => (
        <rect key={m.id} x={mapX(m.x) - 1.6} y={mapY(Math.min(m.y, half ? 0.5 : 1)) - 1.6} width="3.2" height="3.2" fill="#e8862e" />
      ))}
    </svg>
  )
}
