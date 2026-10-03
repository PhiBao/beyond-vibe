/**
 * Screenshots the agent working, in the interface rather than in a terminal.
 *
 * Judges should see the confidence and the refusal, not just a verdict: the
 * refusal on the middle trip is the most interesting frame in the whole product.
 */
import {chromium} from 'playwright'

const BASE = process.env.BASE_URL ?? 'https://ninety-europe.vercel.app'

const browser = await chromium.launch()
const page = await browser.newPage({viewport: {width: 1280, height: 1000}, deviceScaleFactor: 2})

// Two textareas live on this page: the structured one and the agent's. Target the
// agent's by placeholder, or the fill lands in the wrong field.
const box = 'textarea[placeholder*="Sofia"]'
const askButton = page.getByRole('button', {name: 'Work it out', exact: true})

async function ask(text) {
  await page.fill(box, text)
  await askButton.click()
}

await page.goto(`${BASE}/#own`, {waitUntil: 'networkidle'})
await page.waitForTimeout(2000)

await ask(
  'Took the train into Sofia 1 to 11 February 2025, then flew to Paris 20 to 25 February 2025, then an 8 hour airport layover on 3 June 2026 where I never cleared immigration.',
)
await page.waitForTimeout(14000)
await page.locator('#own').scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
await page.screenshot({path: 'demo/15-agent.png'})
console.log('captured 15-agent.png')

// And the carved-out example, which is the clearest possible result.
await ask('Three weeks on Tenerife from 1 to 21 February 2026.')
await page.waitForTimeout(13000)
await page.locator('#own').scrollIntoViewIfNeeded()
await page.waitForTimeout(600)
await page.screenshot({path: 'demo/16-agent-carveout.png'})
console.log('captured 16-agent-carveout.png')

await browser.close()
