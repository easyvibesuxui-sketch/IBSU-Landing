import { chromium } from 'playwright';
const SP = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
const errors = [];
for (const [name, vp] of [['d', { width: 1440, height: 900 }], ['m', { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp });
  page.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(name + ' console: ' + m.text()));
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
  const storyH = await page.evaluate(() => document.querySelector('.story').offsetHeight - innerHeight);
  for (const p of [0.08, 0.45, 0.88, 1]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(storyH * p));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SP}/${name}-story-${Math.round(p * 100)}.png` });
  }
  for (const id of ['why', 'programs', 'admission', 'tuition', 'dates', 'faq', 'apply']) {
    await page.evaluate((id) => window.scrollTo(0, document.getElementById(id).getBoundingClientRect().top + scrollY), id);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SP}/${name}-${id}.png` });
  }
  await page.close();
}
console.log(errors.join('\n') || 'no errors');
await browser.close();
