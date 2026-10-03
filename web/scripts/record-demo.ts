/**
 * Records the demo.
 *
 * Drives the deployed app through the five moments that matter and captures a
 * video, so the recording shows the product responding rather than a cursor
 * drifting over a static page.
 *
 * Usage:
 *   pnpm record                       (against the local dev server on :3001)
 *   BASE_URL=https://... pnpm record  (against production)
 */

import {chromium} from 'playwright'
import {mkdirSync} from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:3001'
const OUT = 'demo'

async function main() {
  mkdirSync(OUT, {recursive: true})

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: {width: 1440, height: 900},
    deviceScaleFactor: 2,
    recordVideo: {dir: `${OUT}/frames`, size: {width: 1440, height: 900}},
  })
  const page = await context.newPage()

  const shot = async (name: string) => {
    await page.screenshot({path: `${OUT}/${name}.png`})
    console.log(`  captured ${name}.png`)
  }

  console.log(`Recording ${BASE}`)
  await page.goto(BASE, {waitUntil: 'networkidle'})
  await page.waitForTimeout(2500)
  await shot('01-verdict')

  // The headline. The meter carries the count in its accessible name.
  const headline =
    (await page.locator('[role="meter"]').first().getAttribute('aria-label').catch(() => '')) ?? ''
  console.log(`  headline: ${headline}`)

  // Click the day the engine says you went over. Its mark carries the breach tone.
  const breachMark = page.locator('button:has(> span.mark-breach)').first()
  if (await breachMark.count()) {
    await breachMark.click()
    await page.waitForTimeout(1500)
    await shot('02-breach-day')
    console.log('  clicked the breach day')
  } else {
    console.log('  WARNING: breach mark not found')
  }

  // A day that cost nothing, and why.
  const carveOut = page.locator('button[aria-label*="Canary Islands"]').first()
  if (await carveOut.count()) {
    await carveOut.click()
    await page.waitForTimeout(1400)
    await shot('03-carve-out')
    console.log('  clicked a Canary Islands day')
  }

  // The day a person ruled on. Day labels carry the territory, not the trip, so
  // match on the date the layover falls on.
  const ruled = page.locator('button[aria-label*="10 Sep 2026"]').first()
  if (await ruled.count()) {
    await ruled.click()
    await page.waitForTimeout(1500)
    await shot('04-ruled-by-a-person')
    console.log('  clicked the day a person ruled on')
  } else {
    console.log('  WARNING: ruled day not found')
  }

  // The trip table.
  await page.locator('#ledger').scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await shot('05-ledger-and-trips')

  // Bring your own history.
  await page.locator('#own').scrollIntoViewIfNeeded()
  await page.waitForTimeout(700)
  await page.fill('textarea', 'FR 2026-06-01 2026-06-30\nIT 2026-07-05 2026-07-20\nES 2026-08-01 2026-08-25')
  await page.click('text=Count my days')
  await page.waitForTimeout(2600)
  await shot('06-own-history')
  console.log('  evaluated a hand-typed history')

  // The agent: describe a trip in plain language.
  await page.locator('#own').scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  await page.fill(
    'textarea[placeholder*="Sofia"]',
    'Took the train into Sofia 1 to 11 February 2025, then flew to Paris 20 to 25 February 2025, then an 8 hour airport layover on 3 June 2026 where I never cleared immigration.',
  )
  await page.getByRole('button', {name: 'Work it out', exact: true}).click()
  await page.waitForTimeout(16000)
  await shot('15-agent')
  console.log('  described a trip in plain language')

  await page.locator('#desk').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)

  // The contested example.
  await page.click('text=The disputed layover')
  await page.waitForTimeout(2500)
  await shot('17-disputed-layover')

  // The desk.
  await page.locator('#desk').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1000)
  await shot('18-the-desk')

  // Adjudicate. This is the moment worth recording: a person resolves a genuine
  // disagreement and the count changes in front of you. The dataset is reset
  // afterwards by `pnpm reset:dispute` so the shared instance stays clean.
  // The headline number cannot change here — the ruling resolves a *future* day.
  // What changes is the verdict, so that is what we watch.
  const verdictBefore = await verdictHeadline(page)
  const before = await page.locator('[role="meter"]').first().getAttribute('aria-label')
  const nameField = page.locator('input[placeholder="e.g. Sam"]')
  if (await nameField.count()) {
    await nameField.fill('Ada')
    await page.waitForTimeout(600)
    await shot('19-before-ruling')
    await page.getByRole('button', {name: 'It counts', exact: true}).click()
    await page.waitForTimeout(7000)
    const after = await page.locator('[role="meter"]').first().getAttribute('aria-label')
    const verdictAfter = await verdictHeadline(page)
    await shot('20-after-ruling')
    console.log(`  meter  before: ${before}   after: ${after}`)
    console.log(`  verdict before: ${verdictBefore}`)
    console.log(`  verdict after : ${verdictAfter}`)
  }

  await page.locator('#ledger').scrollIntoViewIfNeeded()
  await page.waitForTimeout(1400)
  await shot('21-ledger-after-ruling')

  await page.waitForTimeout(1200)
  const video = page.video()
  await context.close()
  await browser.close()

  if (video) {
    const p = await video.path()
    console.log(`Video: ${p}`)
  }
  console.log(`Done. Frames and stills in ${OUT}/`)
}

/** The one-line summary of the verdict card. */
async function verdictHeadline(page: import('playwright').Page): Promise<string> {
  const breach = page.locator('text=You cross the limit here')
  if (await breach.count()) return 'crosses the limit'
  const inside = page.locator('text=Inside the limit')
  if (await inside.count()) return 'inside the limit'
  return 'unknown'
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})