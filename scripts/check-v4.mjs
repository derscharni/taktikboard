import { chromium } from 'playwright-core'

const base = 'http://localhost:4173/taktikboard/'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
})
// bewusst kleines Fenster, damit die Seite scrollbar ist
const ctx = await browser.newContext({ viewport: { width: 390, height: 640 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// --- Schritt-Navigation animiert? ---
// Position von RM in Schritt 1 merken, auf Schritt 2 wechseln, mitten in der
// Animation samplen: liegt die Position zwischen Start und Ziel?
const posOf = () =>
  page.evaluate(() => {
    const g = [...document.querySelectorAll('[data-tok]')].find((el) =>
      el.textContent?.includes('RM'),
    )
    const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(g?.getAttribute('transform') ?? '')
    return m ? { x: +m[1], y: +m[2] } : null
  })
const p1 = await posOf()
await page.getByRole('button', { name: 'Schritt 2' }).click()
await page.waitForTimeout(200) // Mitte der 450ms-Animation
const mid = await posOf()
await page.waitForTimeout(500)
const p2 = await posOf()
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const animated = mid && p1 && p2 && dist(p1, p2) > 0.5 && dist(mid, p1) > 0.05 && dist(mid, p2) > 0.05
console.log('step-nav animiert:', animated, JSON.stringify({ p1, mid, p2 }))

// --- Scroll-Sperre in 3D ---
await page.getByRole('button', { name: 'Schritt 1', exact: false }).first().click()
await page.waitForTimeout(600)
await page.getByRole('button', { name: '3D-Diorama-Ansicht umschalten' }).click()
await page.waitForTimeout(600)
const scrollBefore = await page.evaluate(() => document.getElementById('app-scroll')?.scrollTop ?? -1)
const board = page.locator('[role="application"][aria-label^="3D-Ansicht"]')
const bb = await board.boundingBox()
const cx = bb.x + bb.width / 2
const cy = bb.y + bb.height / 2
// Touch-artige vertikale Drag-Geste über dem Board
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx, cy - 120, { steps: 10 })
await page.mouse.up()
// Wheel über dem Board (würde ohne preventDefault die Seite scrollen)
await page.mouse.wheel(0, 240)
await page.waitForTimeout(300)
const scrollAfter = await page.evaluate(() => document.getElementById('app-scroll')?.scrollTop ?? -1)
console.log('scroll gesperrt in 3D:', scrollBefore === scrollAfter, { scrollBefore, scrollAfter })

// zurück in 2D: Scrollen wieder möglich?
await page.getByRole('button', { name: '2D · Bearbeiten' }).click()
await page.waitForTimeout(400)
await page.mouse.move(200, 500)
await page.mouse.wheel(0, 240)
await page.waitForTimeout(300)
const scroll2d = await page.evaluate(() => document.getElementById('app-scroll')?.scrollTop ?? -1)
console.log('2D wieder scrollbar:', scroll2d > 0, { scroll2d })

await browser.close()
