import { chromium } from 'playwright-core'

const base = 'http://localhost:4173/taktikboard/'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE:', m.text())
})

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await page.screenshot({ path: 'shots/v2-2d.png' })

// Werkzeuge-Panel öffnen
await page.getByRole('button', { name: 'Werkzeuge', exact: true }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'shots/v2-drawer.png' })

// Abwehr aufstellen (schließt Panel)
await page.getByRole('button', { name: /Abwehr 6:0/ }).click()
await page.waitForTimeout(400)

// 3D einschalten
await page.getByRole('button', { name: '3D-Diorama-Ansicht umschalten' }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: 'shots/v2-3d.png' })

// Orbit etwas drehen
const board = page.locator('[role="application"][aria-label^="3D-Ansicht"]')
const bb = await board.boundingBox()
if (bb) {
  const cx = bb.x + bb.width / 2
  const cy = bb.y + bb.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 90, cy + 40, { steps: 8 })
  await page.mouse.up()
}
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/v2-3d-orbit.png' })

// Abspielen in 3D (Aufsteller müssen mitlaufen) — Schritte vorhanden?
const play = page.getByRole('button', { name: /abspielen/i })
if (await play.isEnabled()) {
  await play.click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: 'shots/v2-3d-playing.png' })
  await page.waitForTimeout(2500)
}

// Desktop-Breite
await page.setViewportSize({ width: 1280, height: 800 })
await page.waitForTimeout(600)
await page.screenshot({ path: 'shots/v2-desktop-3d.png' })

await browser.close()
console.log('OK')
