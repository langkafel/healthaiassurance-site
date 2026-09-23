// Lighthouse performance audit against a live URL (not localhost), both
// mobile and desktop presets, for all 8 routes. Plus, for the two
// data-heavy iframe pages, extracts core metrics and measures actual
// time-to-visible-iframe-content via a separate Playwright pass (Lighthouse
// itself has no iframe-specific timing).
import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'test-results');
fs.mkdirSync(outDir, { recursive: true });

const BASE_URL = (process.env.BASE_URL || '').replace(/\/$/, '');
if (!BASE_URL) throw new Error('Set BASE_URL to the live URL to audit');

const ROUTES = ['/', '/loesung', '/buch', '/incident-atlas', '/quick-check', '/solutions-atlas', '/impressum', '/datenschutz'];
const HEAVY_ROUTES = ['/incident-atlas', '/solutions-atlas'];
const HEAVY_SELECTOR = { '/incident-atlas': '.case', '/solutions-atlas': '.kpi' };

function extractDiagnostics(lhr) {
  const perf = lhr.categories.performance;
  const problems = [];
  for (const ref of perf.auditRefs) {
    if (ref.group !== 'diagnostics' && ref.group !== 'load-opportunities') continue;
    const audit = lhr.audits[ref.id];
    if (audit.score !== null && audit.score < 0.9) {
      problems.push({ id: ref.id, title: audit.title, displayValue: audit.displayValue || null });
    }
  }
  return problems;
}

async function runLighthouse(port, url, formFactor) {
  const opts =
    formFactor === 'mobile'
      ? { port, output: 'json', logLevel: 'error', onlyCategories: ['performance'], formFactor: 'mobile' }
      : {
          port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance'],
          formFactor: 'desktop',
          screenEmulation: { disabled: true },
        };
  const result = await lighthouse(url, opts);
  return result.lhr;
}

async function measureIframeVisible(browser, route, selector) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const start = Date.now();
  await page.goto(BASE_URL + route, { waitUntil: 'domcontentloaded' });
  const frameHandle = await page.waitForSelector('.embed-frame iframe', { timeout: 30000 });
  const frame = await frameHandle.contentFrame();
  await frame.waitForSelector(selector, { state: 'visible', timeout: 30000 });
  const elapsed = Date.now() - start;
  await context.close();
  return elapsed;
}

async function main() {
  const browser = await chromium.launch({ args: ['--remote-debugging-port=9227'] });
  const port = 9227;
  const summary = {};

  for (const route of ROUTES) {
    summary[route] = {};
    for (const formFactor of ['mobile', 'desktop']) {
      console.log(`lighthouse ${formFactor}:`, route);
      const lhr = await runLighthouse(port, BASE_URL + route, formFactor);
      const score = Math.round(lhr.categories.performance.score * 100);
      summary[route][formFactor] = {
        score,
        metrics: {
          lcp: lhr.audits['largest-contentful-paint']?.displayValue,
          tbt: lhr.audits['total-blocking-time']?.displayValue,
          cls: lhr.audits['cumulative-layout-shift']?.displayValue,
          fcp: lhr.audits['first-contentful-paint']?.displayValue,
          speedIndex: lhr.audits['speed-index']?.displayValue,
        },
      };
      if (score < 90) {
        summary[route][formFactor].diagnostics = extractDiagnostics(lhr);
      }
      const slug = route.replace(/\//g, '') || 'home';
      fs.writeFileSync(path.join(outDir, `lighthouse-live-${slug}-${formFactor}.json`), JSON.stringify(lhr, null, 2));
    }
  }

  for (const route of HEAVY_ROUTES) {
    console.log('iframe-visible timing:', route);
    const ms = await measureIframeVisible(browser, route, HEAVY_SELECTOR[route]);
    summary[route].iframeVisibleMs = ms;
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'lighthouse-live-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
