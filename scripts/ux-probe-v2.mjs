import { chromium } from 'playwright-core'

const base = 'http://localhost:4173/taktikboard/'

/* ---------- WCAG-Kontrast ---------- */
function parseColor(s) {
  if (!s) return null
  let m = /^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/.exec(s)
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
  m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/.exec(s)
  if (m) return { r: 255 * +m[1], g: 255 * +m[2], b: 255 * +m[3], a: m[4] === undefined ? 1 : +m[4] }
  return null
}
const lin = (c) => {
  c /= 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
function contrast(fg, bg) {
  const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a)
  return (l1 + 0.05) / (l2 + 0.05)
}
function blend(top, bottom) {
  const a = top.a
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  }
}

async function audit(page, label, out) {
  const data = await page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect()
      const st = getComputedStyle(el)
      return (
        r.width > 1 &&
        r.height > 1 &&
        st.visibility !== 'hidden' &&
        st.display !== 'none' &&
        +st.opacity > 0.05 &&
        r.bottom > 0 &&
        r.top < innerHeight + 400
      )
    }
    const bgChain = (el) => {
      const chain = []
      let n = el
      while (n && n !== document.documentElement) {
        const st = getComputedStyle(n)
        chain.push(st.backgroundColor)
        n = n.parentElement
      }
      chain.push(getComputedStyle(document.documentElement).backgroundColor)
      chain.push('rgb(255, 255, 255)')
      return chain
    }
    // Textknoten
    const texts = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const seen = new Set()
    let node
    while ((node = walker.nextNode())) {
      const t = node.textContent?.trim()
      if (!t || t.length < 2) continue
      const el = node.parentElement
      if (!el || seen.has(el) || !vis(el)) continue
      // Elemente in inerten/versteckten Overlays überspringen
      if (el.closest('[inert]')) continue
      seen.add(el)
      const st = getComputedStyle(el)
      texts.push({
        text: t.slice(0, 44),
        color: st.color,
        bgs: bgChain(el),
        size: parseFloat(st.fontSize),
        weight: +st.fontWeight || 400,
        tag: el.tagName,
      })
    }
    // Interaktive Ziele
    const targets = []
    for (const el of document.querySelectorAll('button, a, input, select, [role="button"]')) {
      if (!vis(el) || el.closest('[inert]')) continue
      const r = el.getBoundingClientRect()
      const label =
        el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 36) || el.tagName
      targets.push({ label, w: Math.round(r.width), h: Math.round(r.height), tag: el.tagName, type: el.getAttribute('type') })
    }
    // Überlauf
    const hOverflow = document.documentElement.scrollWidth - innerWidth
    // Überschriften
    const heads = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => h.tagName)
    // Bilder ohne alt
    const badImgs = [...document.querySelectorAll('img:not([alt])')].length
    return { texts, targets, hOverflow, heads, badImgs }
  })
  out[label] = data
}

async function focusCheck(page) {
  return page.evaluate(() => {
    const results = []
    const els = [...document.querySelectorAll('button, input, a')].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 2 && r.height > 2 && !el.closest('[inert]') && el.tabIndex >= 0
    })
    for (const el of els.slice(0, 14)) {
      const before = getComputedStyle(el)
      const b = { o: before.outlineWidth + before.outlineStyle, s: before.boxShadow, bc: before.borderColor }
      el.focus({ preventScroll: true })
      const after = getComputedStyle(el)
      const changed =
        after.outlineStyle !== 'none' && parseFloat(after.outlineWidth) > 0
          ? true
          : after.boxShadow !== b.s || after.borderColor !== b.bc
      results.push({
        label: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 30) || el.tagName,
        visible: changed,
      })
      el.blur()
    }
    return results
  })
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
})
const out = {}

for (const [vpLabel, vp] of [
  ['mobile', { width: 390, height: 844 }],
  ['desktop', { width: 1440, height: 900 }],
]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  await audit(page, `${vpLabel}:2d`, out)
  if (vpLabel === 'mobile') {
    out.focus = await focusCheck(page)
    // Reduzierte Bewegung: Animationen zählen
    await ctx.close()
    const ctx2 = await browser.newContext({ viewport: vp, reducedMotion: 'reduce' })
    const p2 = await ctx2.newPage()
    await p2.goto(base, { waitUntil: 'networkidle' })
    await p2.waitForTimeout(500)
    out.reducedMotionAnimations = await p2.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running' && a.effect?.getTiming().duration > 150).length,
    )
    await ctx2.close()
    const ctx3 = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 })
    const p3 = await ctx3.newPage()
    await p3.goto(base, { waitUntil: 'networkidle' })
    await p3.waitForTimeout(600)
    await p3.getByRole('button', { name: 'Werkzeuge', exact: true }).click()
    await p3.waitForTimeout(400)
    await audit(p3, 'mobile:drawer', out)
    await p3.keyboard.press('Escape')
    await p3.getByRole('dialog', { name: 'Werkzeuge' }).getByLabel('Werkzeuge schließen').click()
    await p3.waitForTimeout(300)
    await p3.getByRole('button', { name: '3D-Diorama-Ansicht umschalten' }).click()
    await p3.waitForTimeout(700)
    await audit(p3, 'mobile:3d', out)
    await p3.screenshot({ path: 'shots/probe-3d.png' })
    await ctx3.close()
    continue
  }
  await ctx.close()
}
await browser.close()

/* ---------- Auswertung ---------- */
const report = { contrastFails: [], smallTargets: [], overflow: {}, heads: {}, focus: out.focus, reducedMotionAnimations: out.reducedMotionAnimations, badImgs: 0 }
for (const [label, d] of Object.entries(out)) {
  if (!d || !d.texts) continue
  for (const t of d.texts) {
    const fg = parseColor(t.color)
    if (!fg) continue
    // effektiven Hintergrund auflösen
    let bg = null
    for (const c of t.bgs) {
      const p = parseColor(c)
      if (!p || p.a === 0) continue
      bg = bg === null ? p : bg
      if (bg && bg.a < 1) bg = blend(bg, p)
      if (bg.a >= 1) break
    }
    if (!bg) bg = { r: 255, g: 255, b: 255, a: 1 }
    const ratio = contrast(fg.a < 1 ? blend(fg, bg) : fg, bg)
    const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700)
    const min = large ? 3 : 4.5
    if (ratio < min) {
      report.contrastFails.push({
        view: label,
        text: t.text,
        ratio: +ratio.toFixed(2),
        need: min,
        size: t.size,
        weight: t.weight,
      })
    }
  }
  for (const tg of d.targets) {
    if ((tg.w < 44 || tg.h < 44) && !(tg.tag === 'A' && tg.h >= 24)) {
      report.smallTargets.push({ view: label, ...tg })
    }
  }
  report.overflow[label] = d.hOverflow
  report.heads[label] = d.heads
  report.badImgs += d.badImgs
}
console.log(JSON.stringify(report, null, 1))
