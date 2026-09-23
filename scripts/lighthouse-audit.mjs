// Runs Lighthouse (programmatic API) against every route, using
// Playwright's bundled Chromium so no separate Chrome install is needed.
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'test-results');
fs.mkdirSync(outDir, { recursive: true });

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4322').replace(/\/$/, '');

const ROUTES = ['/', '/loesung', '/buch', '/incident-atlas', '/quick-check', '/solutions-atlas', '/impressum', '/datenschutz'];

async function main() {
  const browser = await chromium.launch({ args: ['--remote-debugging-port=9222'] });
  const port = 9222;

  const results = {};
  for (const route of ROUTES) {
    console.log('lighthouse:', route);
    const runnerResult = await lighthouse(BASE_URL + route, {
      port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      formFactor: 'desktop',
      screenEmulation: { disabled: true },
    });
    const lhr = runnerResult.lhr;
    results[route] = {
      scores: {
        performance: Math.round(lhr.categories.performance.score * 100),
        accessibility: Math.round(lhr.categories.accessibility.score * 100),
        bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
        seo: Math.round(lhr.categories.seo.score * 100),
      },
      metrics: {
        firstContentfulPaint: lhr.audits['first-contentful-paint']?.displayValue,
        largestContentfulPaint: lhr.audits['largest-contentful-paint']?.displayValue,
        totalBlockingTime: lhr.audits['total-blocking-time']?.displayValue,
        cumulativeLayoutShift: lhr.audits['cumulative-layout-shift']?.displayValue,
        speedIndex: lhr.audits['speed-index']?.displayValue,
      },
    };
    fs.writeFileSync(path.join(outDir, `lighthouse-${route.replace(/\//g, '') || 'home'}.json`), JSON.stringify(lhr, null, 2));
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'lighthouse-summary.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
