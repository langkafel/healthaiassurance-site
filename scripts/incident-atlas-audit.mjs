// One-off Playwright audit for /incident-atlas: reads real computed styles
// out of the built page (not values typed by hand) to check badge contrast,
// dump the embed's actual :root custom properties, and measure whether the
// iframe height-sync avoids a nested scrollbar at 375px.
//
// Usage:
//   npm run build && npm run preview -- --port 4322
//   BASE_URL=http://localhost:4322 node scripts/incident-atlas-audit.mjs
//
// Writes test-results/incident-atlas-contrast.md and two screenshots.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'test-results');
fs.mkdirSync(outDir, { recursive: true });

const BASE_URL = process.env.BASE_URL || 'http://localhost:4322';

function srgbToLinear(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relLuminance({ r, g, b }) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(fg, bg) {
  const l1 = relLuminance(fg);
  const l2 = relLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function parseColor(str) {
  if (!str) return null;
  const m = str.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
}

function toHex({ r, g, b }) {
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
  );
}

// Flattens a (possibly translucent) foreground colour onto a solid backdrop.
function composite(fg, backdrop) {
  if (!fg) return backdrop;
  if (fg.a === undefined || fg.a >= 1) return fg;
  const a = fg.a;
  return {
    r: fg.r * a + backdrop.r * (1 - a),
    g: fg.g * a + backdrop.g * (1 - a),
    b: fg.b * a + backdrop.b * (1 - a),
  };
}

async function findEffectiveBackground(handle) {
  return handle.evaluate((node) => {
    let el = node;
    let bg = getComputedStyle(el).backgroundColor;
    while (el && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) {
      el = el.parentElement;
      if (!el) break;
      bg = getComputedStyle(el).backgroundColor;
    }
    return bg || 'rgb(0, 0, 0)';
  });
}

const ROOT_VAR_NAMES = [
  '--bg',
  '--panel',
  '--panel2',
  '--line',
  '--text',
  '--muted',
  '--cyan',
  '--green',
  '--amber',
  '--pink',
  '--blue',
  '--accent-ink',
  '--green-text',
  '--amber-text',
  '--pink-text',
  '--shadow',
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const lines = [];
  lines.push('# /incident-atlas audit');
  lines.push('');
  lines.push(`Generated ${new Date().toISOString()} against ${BASE_URL}`);
  lines.push('');

  // ---------- 1440px pass: screenshot + badge contrast + root vars ----------
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/incident-atlas`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500); // let the postMessage height-sync + CSS transition settle

  const shot1440 = path.join(outDir, 'incident-atlas-1440.png');
  await page.screenshot({ path: shot1440, fullPage: true });

  const frameHandle = await page.$('.embed-frame iframe');
  if (!frameHandle) throw new Error('Could not find .embed-frame iframe on /incident-atlas');
  const frame = await frameHandle.contentFrame();
  if (!frame) throw new Error('Could not access iframe content frame (cross-origin?)');
  await frame.waitForSelector('.badge.a', { timeout: 10000 });

  // ---------- Root variables, read from the actual rendered iframe document ----------
  const rootVars = await frame.evaluate((names) => {
    const cs = getComputedStyle(document.documentElement);
    const out = {};
    for (const n of names) out[n] = cs.getPropertyValue(n).trim() || '(empty)';
    return out;
  }, ROOT_VAR_NAMES);

  lines.push('## Root variables (as computed in the built page, not typed by hand)');
  lines.push('');
  lines.push('| Variable | Computed value |');
  lines.push('| --- | --- |');
  for (const name of ROOT_VAR_NAMES) {
    lines.push(`| \`${name}\` | \`${rootVars[name]}\` |`);
  }
  lines.push('');

  // ---------- Badge contrast: real getComputedStyle + WCAG formula computed here ----------
  const badgeClasses = ['a', 'b', 'c', 'd'];
  const badgeRows = [];
  for (const cls of badgeClasses) {
    const locator = frame.locator(`.badge.${cls}`).first();
    const count = await locator.count();
    if (count === 0) {
      badgeRows.push({ cls, missing: true });
      continue;
    }
    const handle = await locator.elementHandle();
    const styles = await handle.evaluate((node) => {
      const cs = getComputedStyle(node);
      return { color: cs.color, borderColor: cs.borderColor, ownBackground: cs.backgroundColor };
    });
    const effectiveBgStr = await findEffectiveBackground(handle);

    const fg = parseColor(styles.color);
    const border = parseColor(styles.borderColor);
    const effectiveBg = parseColor(effectiveBgStr) || { r: 0, g: 0, b: 0, a: 1 };
    const fgFlat = composite(fg, effectiveBg);
    const ratio = contrastRatio(fgFlat, effectiveBg);

    badgeRows.push({
      cls,
      textHex: toHex(fgFlat),
      bgHex: toHex(effectiveBg),
      borderHex: border ? toHex(composite(border, effectiveBg)) : 'n/a',
      ratio,
      pass: ratio >= 4.5,
    });
  }

  lines.push('## Badge contrast (text vs. effective background, walked up the DOM to the nearest opaque ancestor)');
  lines.push('');
  lines.push('| Badge | Text colour | Background | Border colour | Contrast | vs. 4.5:1 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const row of badgeRows) {
    if (row.missing) {
      lines.push(`| \`.badge.${row.cls}\` | — | — | — | — | element not found |`);
      continue;
    }
    lines.push(
      `| \`.badge.${row.cls}\` | \`${row.textHex}\` | \`${row.bgHex}\` | \`${row.borderHex}\` | ${row.ratio.toFixed(2)}:1 | ${row.pass ? 'PASS' : 'FAIL'} |`
    );
  }
  lines.push('');

  // ---------- 375px pass: screenshot + double-scroll measurement ----------
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE_URL}/incident-atlas`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700); // load -> postMessage -> resize -> CSS transition

  const shot375 = path.join(outDir, 'incident-atlas-375.png');
  await page.screenshot({ path: shot375, fullPage: true });

  const wrapperHandle = await page.$('.embed-frame');
  const wrapperBox = await wrapperHandle.boundingBox();
  const frameHandle375 = await page.$('.embed-frame iframe');
  const frame375 = await frameHandle375.contentFrame();
  await frame375.waitForSelector('.badge.a', { timeout: 10000 });

  const contentMetrics = await frame375.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));

  const wrapperHeight = Math.round(wrapperBox.height);
  const noDoubleScroll = wrapperHeight >= contentMetrics.scrollHeight;
  const innerOverflow = contentMetrics.scrollHeight > contentMetrics.clientHeight;

  lines.push('## 375px double-scroll check (measured, not estimated)');
  lines.push('');
  lines.push(`- \`.embed-frame\` wrapper rendered height: **${wrapperHeight}px**`);
  lines.push(`- iframe content \`document.documentElement.scrollHeight\`: **${contentMetrics.scrollHeight}px**`);
  lines.push(`- iframe's own viewport \`document.documentElement.clientHeight\`: **${contentMetrics.clientHeight}px**`);
  lines.push(
    `- Wrapper height ${noDoubleScroll ? '>=' : '<'} content scrollHeight -> ${
      noDoubleScroll ? 'wrapper is tall enough to show all content, no internal clipping needed' : 'wrapper is SHORTER than the content -- content would be clipped or need internal scroll'
    }`
  );
  lines.push(
    `- Inside the iframe, scrollHeight ${innerOverflow ? '>' : '<='} clientHeight -> ${
      innerOverflow ? 'the iframe document itself still thinks it needs to scroll internally (potential double scrollbar)' : 'no internal scroll needed inside the iframe document'
    }`
  );
  lines.push(
    `- **Verdict: ${noDoubleScroll && !innerOverflow ? 'CONFIRMED — no double scrollbar at 375px' : 'NOT CONFIRMED — see numbers above'}**`
  );
  lines.push('');

  lines.push('## Screenshots');
  lines.push('');
  lines.push('- `test-results/incident-atlas-1440.png`');
  lines.push('- `test-results/incident-atlas-375.png`');
  lines.push('');

  fs.writeFileSync(path.join(outDir, 'incident-atlas-contrast.md'), lines.join('\n'));

  await browser.close();

  console.log('Done.');
  console.log('Root vars:', rootVars);
  console.log('Badge rows:', badgeRows);
  console.log('375px check:', { wrapperHeight, ...contentMetrics, noDoubleScroll, innerOverflow });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
