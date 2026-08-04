import { uid } from './db'
import type {
  BoardMaterial,
  BoardToken,
  FieldColors,
  MaterialKind,
  StepPositions,
  TacticsBoard,
  TokenKind,
} from './types'

/**
 * Teilen & Sichern von Spielzügen:
 * - kompaktes, versioniertes Austauschformat (JSON)
 * - Link-Kodierung (deflate + base64url) für WhatsApp & Co. — der ganze
 *   Zug steckt im Link, kein Server nötig
 * - Datei-Export/-Import (.taktik.json)
 * - PNG-Export des Boards (SVG → Canvas), teilbar über das System-Menü
 */

export interface ShareData {
  v: 1
  t: string
  f: 'full' | 'half'
  g?: string[]
  /** Figuren: [kind, label, x, y] — Index = Referenz in den Schritten. */
  k: [string, string, number, number][]
  m: [string, number, number][]
  s: Record<string, [number, number]>[]
}

const r4 = (n: number) => Math.round(n * 10000) / 10000

export function serializeBoard(b: TacticsBoard): ShareData {
  const idx = new Map(b.tokens.map((t, i) => [t.id, i]))
  return {
    v: 1,
    t: b.title,
    f: b.field,
    g: b.tags && b.tags.length > 0 ? b.tags : undefined,
    k: b.tokens.map((t) => [t.kind, t.label ?? '', r4(t.x), r4(t.y)]),
    m: b.materials.map((m) => [m.kind, r4(m.x), r4(m.y)]),
    s: b.steps.map((st) => {
      const o: Record<string, [number, number]> = {}
      for (const [id, p] of Object.entries(st)) {
        const i = idx.get(id)
        if (i !== undefined) o[i] = [r4(p.x), r4(p.y)]
      }
      return o
    }),
  }
}

export function deserializeBoard(d: ShareData): TacticsBoard {
  const tokens: BoardToken[] = d.k.map(([kind, label, x, y]) => ({
    id: uid(),
    kind: kind as TokenKind,
    label: label || undefined,
    x,
    y,
  }))
  const materials: BoardMaterial[] = d.m.map(([kind, x, y]) => ({
    id: uid(),
    kind: kind as MaterialKind,
    x,
    y,
  }))
  const steps: StepPositions[] = d.s.map((o) => {
    const st: StepPositions = {}
    for (const [i, [x, y]] of Object.entries(o)) {
      const t = tokens[Number(i)]
      if (t) st[t.id] = { x, y }
    }
    return st
  })
  if (steps.length === 0) {
    const base: StepPositions = {}
    for (const t of tokens) base[t.id] = { x: t.x, y: t.y }
    steps.push(base)
  }
  return {
    id: uid(),
    title: d.t || 'Geteilter Zug',
    field: d.f === 'full' ? 'full' : 'half',
    tokens,
    materials,
    steps,
    tags: d.g,
    updatedAt: new Date().toISOString(),
  }
}

/* ---------- Link-Kodierung ---------- */

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x4000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x4000))
  }
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export async function encodeShare(board: TacticsBoard): Promise<string> {
  const json = JSON.stringify(serializeBoard(board))
  const bytes = new TextEncoder().encode(json)
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    const buf = new Uint8Array(await new Response(stream).arrayBuffer())
    return 'c' + bytesToB64url(buf)
  }
  return 'p' + bytesToB64url(bytes)
}

export async function decodeShare(code: string): Promise<TacticsBoard | null> {
  try {
    const kind = code[0]
    const bytes = b64urlToBytes(code.slice(1))
    let json: string
    if (kind === 'c') {
      const stream = new Blob([bytes as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream('deflate-raw'))
      json = await new Response(stream).text()
    } else {
      json = new TextDecoder().decode(bytes)
    }
    const data = JSON.parse(json) as ShareData
    if (data.v !== 1 || !Array.isArray(data.k) || !Array.isArray(data.s)) return null
    return deserializeBoard(data)
  } catch {
    return null
  }
}

export async function boardToShareUrl(board: TacticsBoard): Promise<string> {
  const code = await encodeShare(board)
  return `${location.origin}${location.pathname}#zug=${code}`
}

/** Geteilten Zug aus der URL lesen (…#zug=…), ohne die URL zu verändern. */
export async function boardFromLocationHash(): Promise<TacticsBoard | null> {
  const m = /#zug=([A-Za-z0-9_-]+)/.exec(location.hash)
  if (!m) return null
  return decodeShare(m[1])
}

export function clearShareHash(): void {
  if (location.hash.startsWith('#zug=')) {
    history.replaceState(null, '', location.pathname + location.search)
  }
}

/* ---------- Datei-Export / -Import ---------- */

export function downloadBoardFile(board: TacticsBoard): void {
  const json = JSON.stringify(serializeBoard(board), null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${(board.title || 'spielzug').replace(/[^\wäöüÄÖÜß -]+/g, '').trim() || 'spielzug'}.taktik.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export async function boardFromFile(file: File): Promise<TacticsBoard | null> {
  try {
    const data = JSON.parse(await file.text()) as ShareData
    if (data.v !== 1 || !Array.isArray(data.k)) return null
    return deserializeBoard(data)
  } catch {
    return null
  }
}

/* ---------- PNG-Export ---------- */

function mixHex(a: string, b: string, wa: number): string {
  const pa = /^#?(..)(..)(..)$/.exec(a)
  const pb = /^#?(..)(..)(..)$/.exec(b)
  if (!pa || !pb) return a
  const c = (i: number) =>
    Math.round(parseInt(pa[i], 16) * wa + parseInt(pb[i], 16) * (1 - wa))
      .toString(16)
      .padStart(2, '0')
  return `#${c(1)}${c(2)}${c(3)}`
}

/**
 * Board-SVG als PNG rendern. CSS-Variablen werden vorher durch die
 * konkreten Farben ersetzt, damit das Bild außerhalb der App identisch
 * aussieht.
 */
export async function boardToPngBlob(
  svg: SVGSVGElement,
  colors: FieldColors,
  width = 1400,
): Promise<Blob | null> {
  const rootStyle = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => rootStyle.getPropertyValue(name).trim() || fallback
  let str = svg.outerHTML
  str = str.replaceAll(
    'color-mix(in srgb, var(--court) 78%, #10131a)',
    mixHex(colors.court, '#10131a', 0.78),
  )
  const repl: [string, string][] = [
    ['var(--court-lines)', colors.lines],
    ['var(--court-area)', colors.area],
    ['var(--court)', colors.court],
    ['var(--club-acc-ink)', v('--club-acc-ink', '#172b5e')],
    ['var(--club-acc)', v('--club-acc', '#ffc72c')],
    ['var(--club-700)', v('--club-700', '#14418f')],
    ['var(--font-display)', "'Arial Narrow', Arial, sans-serif"],
  ]
  for (const [from, to] of repl) str = str.replaceAll(from, to)

  const vb = svg.viewBox.baseVal
  const height = Math.round((width * vb.height) / vb.width)
  const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('SVG konnte nicht gerendert werden'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}
