// Specifically checks whether visiting /quick-check in a session leaves
// any visible effect on other pages afterward (the concern: did splitting
// Quick Check's CSS into scoped + is:global blocks leak anything?).
// Captures computed styles on / and /buch BEFORE visiting /quick-check,
// then again in the SAME page object AFTER navigating through
// /quick-check and back, and diffs them.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'test-results');
const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) throw new Error('Set BASE_URL');

async function snapshot(page, route) {
  await page.goto(BASE_URL + route, { waitUntil: 'networkidle' });
  return page.evaluate(() => {
    const p = document.querySelector('p');
    const h1 = document.querySelector('h1');
    const btn = document.querySelector('.btn-primary, .btn');
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const pick = (cs) => (cs ? { margin: cs.margin, padding: cs.padding, boxSizing: cs.boxSizing, fontFamily: cs.fontFamily, color: cs.color } : null);
    return {
      title: document.title,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      p: pick(cs(p)),
      h1: pick(cs(h1)),
      btn: pick(cs(btn)),
    };
  });
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const before = {
    home: await snapshot(page, '/'),
    buch: await snapshot(page, '/buch'),
  };

  // Now visit quick-check and play through it a bit (in the SAME page/session)
  await page.goto(BASE_URL + '/quick-check', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Quick Check starten")');
  await page.waitForSelector('#qopts .opt');
  await page.click('#qopts .opt >> nth=0');
  await page.waitForTimeout(300);

  const after = {
    home: await snapshot(page, '/'),
    buch: await snapshot(page, '/buch'),
  };

  const diff = {
    home: JSON.stringify(before.home) === JSON.stringify(after.home) ? 'IDENTICAL' : { before: before.home, after: after.home },
    buch: JSON.stringify(before.buch) === JSON.stringify(after.buch) ? 'IDENTICAL' : { before: before.buch, after: after.buch },
  };

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'css-leak-check.json'), JSON.stringify({ before, after, diff }, null, 2));
  console.log(JSON.stringify(diff, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
