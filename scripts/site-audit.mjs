// Comprehensive pre-launch audit against a live URL, using a real browser
// (Chromium via Playwright) -- not derived from source code.
//
// Usage: BASE_URL=http://... node scripts/site-audit.mjs
//
// Writes:
//   test-results/site-audit.md          (structured findings report)
//   test-results/screenshots/*.png      (every route x 1440/375)

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'test-results');
const shotDir = path.join(outDir, 'screenshots');
fs.mkdirSync(shotDir, { recursive: true });

const BASE_URL = (process.env.BASE_URL || 'http://localhost:4322').replace(/\/$/, '');

const ROUTES = [
  { path: '/', slug: 'home' },
  { path: '/loesung', slug: 'loesung' },
  { path: '/buch', slug: 'buch' },
  { path: '/incident-atlas', slug: 'incident-atlas', hasIframe: true },
  { path: '/quick-check', slug: 'quick-check' },
  { path: '/solutions-atlas', slug: 'solutions-atlas', hasIframe: true },
  { path: '/impressum', slug: 'impressum' },
  { path: '/datenschutz', slug: 'datenschutz' },
];

const VIEWPORTS = [
  { width: 1440, height: 900, label: '1440' },
  { width: 375, height: 812, label: '375' },
];

const KNOWN_TODOS = new Set(['TODO_MEDHOCHZWEI_URL', 'https://www.linkedin.com/in/TODO-linkedin-profil']);
const EXPECTED_LOGIN = 'https://app.healthaiassurance.de';
const EXPECTED_MAILTO = 'mailto:info@peter-langkafel.de';
const EXPECTED_PL_LINK = 'https://peter-langkafel.de';

const report = {
  routes: {},
  blockers: [],
  minor: [],
  ok: [],
};

function addBlocker(msg) {
  report.blockers.push(msg);
}
function addMinor(msg) {
  report.minor.push(msg);
}
function addOk(msg) {
  report.ok.push(msg);
}

async function checkedFetch(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 'ERR:' + e.message };
  }
}

async function auditRoute(browser, route) {
  const routeReport = { path: route.path, byViewport: {}, links: [], meta: {}, console: [], requests: [] };

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    const consoleMsgs = [];
    const requests = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleMsgs.push({ type: msg.type(), text: msg.text() });
      }
    });
    page.on('pageerror', (err) => consoleMsgs.push({ type: 'pageerror', text: err.message }));
    page.on('request', (req) => requests.push(req.url()));

    await page.goto(BASE_URL + route.path, { waitUntil: 'networkidle', timeout: 30000 });
    if (route.hasIframe) await page.waitForTimeout(900); // postMessage height-sync + CSS transition

    const shotPath = path.join(shotDir, `${route.slug}-${vp.label}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });

    // Layout-break heuristics: horizontal overflow, and (for iframe pages)
    // whether the iframe wrapper matured to the content's real height.
    const overflowInfo = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    const hasHorizontalOverflow = overflowInfo.scrollWidth > overflowInfo.clientWidth + 1;

    let iframeCheck = null;
    if (route.hasIframe) {
      const wrapper = await page.$('.embed-frame');
      const frameEl = await page.$('.embed-frame iframe');
      if (wrapper && frameEl) {
        const box = await wrapper.boundingBox();
        const frame = await frameEl.contentFrame();
        const inner = frame
          ? await frame.evaluate(() => ({
              scrollHeight: document.documentElement.scrollHeight,
              clientHeight: document.documentElement.clientHeight,
            }))
          : null;
        iframeCheck = {
          wrapperHeight: box ? Math.round(box.height) : null,
          innerScrollHeight: inner?.scrollHeight ?? null,
          innerClientHeight: inner?.clientHeight ?? null,
          noDoubleScroll: box && inner ? box.height >= inner.scrollHeight : null,
        };
      }
    }

    routeReport.byViewport[vp.label] = {
      screenshot: path.relative(outDir, shotPath),
      hasHorizontalOverflow,
      iframeCheck,
      consoleIssues: consoleMsgs,
    };

    if (vp.label === '1440') {
      // ---- meta tags ----
      routeReport.meta = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || null,
        ogTitle: document.querySelector('meta[property="og:title"]')?.content || null,
        ogDescription: document.querySelector('meta[property="og:description"]')?.content || null,
        ogUrl: document.querySelector('meta[property="og:url"]')?.content || null,
        canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      }));

      // ---- links ----
      routeReport.links = await page.$$eval('a[href]', (els) =>
        els.map((a) => ({ href: a.getAttribute('href'), text: a.textContent.trim().slice(0, 60), target: a.target }))
      );

      // ---- axe-core accessibility / contrast scan ----
      try {
        const axeResults = await new AxeBuilder({ page }).analyze();
        routeReport.axeViolations = axeResults.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
        }));
      } catch (e) {
        routeReport.axeViolations = [{ id: 'axe-error', impact: 'n/a', help: e.message, nodes: 0 }];
      }
    }

    // ---- font host check ----
    const badFontHosts = requests.filter((u) => /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(u));
    if (badFontHosts.length && !routeReport.badFontHosts) routeReport.badFontHosts = badFontHosts;

    await context.close();
  }

  return routeReport;
}

async function checkLinks(routeReport) {
  const results = [];
  for (const link of routeReport.links) {
    const href = link.href;
    if (!href || href.startsWith('#')) continue;
    if (href.startsWith('mailto:')) {
      results.push({ href, kind: 'mailto', ok: href === EXPECTED_MAILTO, note: href === EXPECTED_MAILTO ? 'correct address' : 'UNEXPECTED ADDRESS' });
      continue;
    }
    if (KNOWN_TODOS.has(href)) {
      results.push({ href, kind: 'todo-placeholder', ok: null, note: 'known open TODO, not a bug' });
      continue;
    }
    if (href.startsWith('http')) {
      const isLogin = href.startsWith(EXPECTED_LOGIN);
      const isPL = href.startsWith(EXPECTED_PL_LINK);
      const check = await checkedFetch(href);
      results.push({
        href,
        kind: isLogin ? 'login-external' : isPL ? 'peter-langkafel-external' : 'external',
        ok: check.ok,
        note: `status ${check.status}`,
      });
      continue;
    }
    // internal relative link
    const check = await checkedFetch(BASE_URL + href);
    results.push({ href, kind: 'internal', ok: check.ok, note: `status ${check.status}` });
  }
  return results;
}

async function playQuickCheck(browser) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  const result = { started: false, questionsAnswered: 0, resultShown: false, resultText: null, restartWorks: false, errors };
  try {
    await page.goto(BASE_URL + '/quick-check', { waitUntil: 'networkidle' });
    await page.click('button:has-text("Quick Check starten")', { timeout: 10000 });
    result.started = true;

    for (let i = 0; i < 12; i++) {
      await page.waitForSelector('#qopts .opt', { timeout: 10000 });
      await page.click('#qopts .opt >> nth=0');
      result.questionsAnswered++;
      const nextBtn = page.locator('#btnNext');
      await nextBtn.waitFor({ state: 'visible', timeout: 10000 });
      await nextBtn.click();
      await page.waitForTimeout(150);
    }

    await page.waitForSelector('#screen-result.active', { timeout: 10000 });
    result.resultShown = true;
    result.resultText = (await page.locator('#resultMeta').textContent())?.trim() || null;

    await page.click('button:has-text("Nochmal versuchen")');
    await page.waitForSelector('#screen-intro.active', { timeout: 10000 });
    result.restartWorks = true;
  } catch (e) {
    result.error = e.message;
  }
  await context.close();
  return result;
}

async function playSolutionsAtlas(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const result = { tabsWork: false, searchWorks: false, selectFilterWorks: false, paginationWorks: false, error: null };
  try {
    await page.goto(BASE_URL + '/solutions-atlas', { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const frame = await (await page.$('.embed-frame iframe')).contentFrame();

    await frame.click('[data-page="explorer"]');
    await frame.waitForSelector('.table-wrap', { timeout: 10000 });
    // Table is paginated (25 rows/page), so row COUNT doesn't reflect the
    // filtered total -- read the result-count label instead.
    const countBefore = (await frame.locator('#resultCount').textContent())?.trim();

    const searchInput = frame.locator('#q');
    await searchInput.fill('Radiology');
    await frame.waitForTimeout(500);
    const countAfterSearch = (await frame.locator('#resultCount').textContent())?.trim();
    result.searchWorks = countAfterSearch !== countBefore;
    result.searchCounts = { before: countBefore, after: countAfterSearch };
    await searchInput.fill('');
    await frame.waitForTimeout(300);

    // dropdown select filter (#panel)
    const panelSelect = frame.locator('#panel');
    const countBeforePanel = (await frame.locator('#resultCount').textContent())?.trim();
    const options = await panelSelect.locator('option').allTextContents();
    const nonEmptyOption = options.find((o, i) => i > 0);
    if (nonEmptyOption) {
      await panelSelect.selectOption({ label: nonEmptyOption });
      await frame.waitForTimeout(500);
      const countAfterPanel = (await frame.locator('#resultCount').textContent())?.trim();
      result.selectFilterWorks = countAfterPanel !== countBeforePanel;
      result.selectFilterCounts = { option: nonEmptyOption, before: countBeforePanel, after: countAfterPanel };
      await panelSelect.selectOption({ index: 0 });
      await frame.waitForTimeout(300);
    }

    // pagination
    const firstRowBefore = (await frame.locator('.data-table tbody tr').first().textContent())?.trim();
    const nextBtn = frame.locator('#nextPage');
    if ((await nextBtn.count()) && !(await nextBtn.isDisabled())) {
      await nextBtn.click();
      await frame.waitForTimeout(400);
      const firstRowAfter = (await frame.locator('.data-table tbody tr').first().textContent())?.trim();
      result.paginationWorks = firstRowAfter !== firstRowBefore;
    }

    await frame.click('[data-page="sources"]');
    await frame.waitForSelector('#page-sources.active', { timeout: 10000 });
    await frame.click('[data-page="global"]');
    await frame.waitForSelector('#page-global.active', { timeout: 10000 });
    result.tabsWork = true;
  } catch (e) {
    result.error = e.message;
  }
  await context.close();
  return result;
}

async function playIncidentAtlas(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const result = { filterWorks: false, tabWorks: false, modalWorks: false, error: null };
  try {
    await page.goto(BASE_URL + '/incident-atlas', { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const frame = await (await page.$('.embed-frame iframe')).contentFrame();

    // Test the modal on the default (unfiltered) view first, so a later
    // filter/tab step can't leave zero cases and make this time out.
    // The card itself has no click handler -- the "Fallakte öffnen" button does.
    const openBtn = frame.locator('.case button[data-open]').first();
    await openBtn.click();
    const dialogVisible = await frame.locator('.dialog').isVisible().catch(() => false);
    result.modalWorks = dialogVisible;
    if (dialogVisible) {
      // Drive the native <dialog>.close() directly rather than the close
      // button -- this is a state reset for the next sub-test, not itself
      // the thing under test.
      await frame.locator('dialog').evaluate((d) => d.close());
      await frame.waitForTimeout(200);
    }

    const countBefore = await frame.locator('.case').count();
    const searchInput = frame.locator('#q');
    await searchInput.fill('FDA');
    await frame.waitForTimeout(400);
    const countAfter = await frame.locator('.case').count();
    result.filterWorks = countAfter <= countBefore;
    result.filterCounts = { before: countBefore, after: countAfter };
    await searchInput.fill('');
    await frame.waitForTimeout(300);

    // Only exercise a kind-tab that actually has matching cases, so the
    // click target exists regardless of which kind happens to be first.
    const tabButtons = frame.locator('[data-kind]');
    const tabCount = await tabButtons.count();
    for (let i = 0; i < tabCount; i++) {
      await tabButtons.nth(i).click();
      await frame.waitForTimeout(300);
      const visibleCases = await frame.locator('.case').count();
      if (visibleCases > 0) {
        result.tabWorks = true;
        break;
      }
    }
  } catch (e) {
    result.error = e.message;
  }
  await context.close();
  return result;
}

async function main() {
  const browser = await chromium.launch();

  console.log('robots.txt / sitemap.xml ...');
  const robots = await checkedFetch(BASE_URL + '/robots.txt');
  const sitemap = await checkedFetch(BASE_URL + '/sitemap-index.xml');
  report.robots = robots;
  report.sitemap = sitemap;

  for (const route of ROUTES) {
    console.log('auditing', route.path);
    const routeReport = await auditRoute(browser, route);
    routeReport.linkChecks = await checkLinks(routeReport);
    report.routes[route.path] = routeReport;
  }

  console.log('quick check playthrough ...');
  report.quickCheck = await playQuickCheck(browser);

  console.log('solutions atlas interactivity ...');
  report.solutionsAtlas = await playSolutionsAtlas(browser);

  console.log('incident atlas interactivity ...');
  report.incidentAtlas = await playIncidentAtlas(browser);

  await browser.close();

  fs.writeFileSync(path.join(outDir, 'site-audit-raw.json'), JSON.stringify(report, null, 2));
  console.log('Raw data written. Now building markdown report...');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
