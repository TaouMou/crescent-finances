import { chromium } from 'playwright';

const EXEC = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const url = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || '/tmp/dashboard.png';
const dark = process.argv[4] === 'dark';
const mobile = process.argv[5] === 'mobile';

const browser = await chromium.launch({ executablePath: EXEC });
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 980 },
  deviceScaleFactor: 2,
  colorScheme: dark ? 'dark' : 'light',
  serviceWorkers: 'block' // avoid stale PWA cache between rebuilds
});
const page = await context.newPage();
const openMenu = process.argv[6] === 'menu';
if (dark) {
  await page.addInitScript(() => {
    try { localStorage.setItem('crescent.theme', 'dark'); } catch {}
  });
}
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(900); // let chart + transitions settle
if (openMenu) {
  await page.getByLabel('Open menu').click();
  await page.waitForTimeout(350);
}
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log('shot:', out);
