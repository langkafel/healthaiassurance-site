// Drives the new 15-question/5-option Quick Check end to end with a real
// browser: full playthrough, category breakdown rendering, console-error
// check, and screenshots of the question screen (desktop + mobile) to
// visually confirm the 5-option layout doesn't look cramped.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'test-results');
fs.mkdirSync(outDir, { recursive: true });
const BASE_URL = process.env.BASE_URL || 'http://localhost:4322';

async function main() {
  const browser = await chromium.launch();
  const report = {};

  for (const vp of [{ w: 1024, label: 'desktop' }, { w: 375, label: 'mobile' }]) {
    const context = await browser.newContext({ viewport: { width: vp.w, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(BASE_URL + '/quick-check', { waitUntil: 'networkidle' });
    await page.click('button:has-text("Quick Check starten")');
    await page.waitForSelector('#qopts .opt');

    // screenshot the question screen with all 5 options visible
    await page.screenshot({ path: path.join(outDir, `screenshots/quickcheck15-question-${vp.label}.png`), fullPage: true });
    const optCount = await page.locator('#qopts .opt').count();

    // answer all 15 questions (always pick option index 0, doesn't matter for flow testing)
    let questionsAnswered = 0;
    for (let i = 0; i < 15; i++) {
      await page.waitForSelector('#qopts .opt', { timeout: 10000 });
      await page.click('#qopts .opt >> nth=0');
      questionsAnswered++;
      const nextBtn = page.locator('#btnNext');
      await nextBtn.waitFor({ state: 'visible', timeout: 10000 });
      await nextBtn.click();
      await page.waitForTimeout(100);
    }

    await page.waitForSelector('#screen-result.active', { timeout: 10000 });
    const resultMeta = (await page.locator('#resultMeta').textContent())?.trim();
    const catInsight = (await page.locator('#catInsight').textContent())?.trim();
    const catRows = await page.locator('.cat-row').count();
    const catRowTexts = await page.locator('.cat-row-top').allTextContents();

    await page.screenshot({ path: path.join(outDir, `screenshots/quickcheck15-result-${vp.label}.png`), fullPage: true });

    report[vp.label] = {
      optionsRenderedOnFirstQuestion: optCount,
      questionsAnswered,
      resultMeta,
      catInsight,
      catRows,
      catRowTexts,
      consoleErrors: errors,
    };

    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'quick-check-15-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
