import { chromium } from 'playwright-core'

const base = 'http://localhost:4173/taktikboard/'
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

await page.goto(base, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)

// Bottom-Sheet auf Mobile
await page.getByRole('button', { name: 'Werkzeuge', exact: true }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: 'shots/v3-sheet.png' })
await page.getByRole('dialog', { name: 'Werkzeuge' }).getByLabel('Werkzeuge schließen').click()
await page.waitForTimeout(300)

// 3D: Sockel + schwebende Figuren + reduzierte UI
await page.getByRole('button', { name: '3D-Diorama-Ansicht umschalten' }).click()
await page.waitForTimeout(800)
await page.screenshot({ path: 'shots/v3-3d.png' })

// Rundum drehen (großer Yaw + flacher Winkel)
const board = page.locator('[role="application"][aria-label^="3D-Ansicht"]')
const bb = await board.boundingBox()
const cx = bb.x + bb.width / 2
const cy = bb.y + bb.height / 2
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx + 260, cy + 60, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/v3-3d-spin.png' })

// Flacher Blick von der Seite
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx + 150, cy + 120, { steps: 12 })
await page.mouse.up()
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/v3-3d-low.png' })

// Abspielen in 3D → Stopp-Zustand
const play = page.getByRole('button', { name: /abspielen/i })
if (await play.isEnabled()) {
  await play.click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'shots/v3-3d-playing.png' })
  await page.getByRole('button', { name: 'Abspielen stoppen' }).click()
  await page.waitForTimeout(300)
}

await browser.close()
console.log('OK')
