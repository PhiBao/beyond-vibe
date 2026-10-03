import {chromium} from 'playwright'
const b = await chromium.launch()
const p = await b.newPage({viewport:{width:1280,height:1100}, deviceScaleFactor:2})
await p.goto('https://ninety-europe.vercel.app/context', {waitUntil:'networkidle'})
await p.waitForTimeout(3000)
await p.screenshot({path:'demo/13-context.png'})
await p.screenshot({path:'demo/14-context-full.png', fullPage:true})
console.log('captured')
await b.close()
