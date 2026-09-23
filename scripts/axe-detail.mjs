// Follow-up detail pass: pull full axe-core violation node info (target
// selectors, actual colors where axe computed them, failure summaries)
// for the pages that showed violations in site-audit.mjs.
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'test-results');
const BASE_URL = (process.env.BASE_URL || 'http://localhost:4322').replace(/\/$/, '');

const targets = ['/', '/loesung', '/buch', '/incident-atlas', '/solutions-atlas'];

async function main() {
  const browser = await chromium.launch();
  const out = {};
  for (const p of targets) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE_URL + p, { waitUntil: 'networkidle' });
    if (p.includes('atlas')) await page.waitForTimeout(900);
    const results = await new AxeBuilder({ page }).include('html').analyze();
    out[p] = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        failureSummary: n.failureSummary,
        html: (n.html || '').slice(0, 200),
      })),
    }));
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'axe-detail.json'), JSON.stringify(out, null, 2));
  console.log('written axe-detail.json');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
