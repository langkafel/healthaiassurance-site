// Generates the brand assets that can't be plain CSS/HTML:
//   public/og/og-default.png   1200x630 Open Graph / Twitter card fallback
//   public/favicon.svg         "HAA" initials placeholder (hand-drawn paths, no font dependency)
//   public/favicon.ico         16/32/48 px, PNG-in-ICO
//   public/apple-touch-icon.png 180x180
//
// Rendered with the project's own self-hosted Montserrat files (embedded as
// data URIs so the render doesn't depend on file:// font loading) and the
// design-system colors. Re-run after changing the claim or palette:
//   node scripts/generate-brand-assets.mjs
//
// The favicon is a placeholder until a real logo is supplied.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
fs.mkdirSync(path.join(pub, 'og'), { recursive: true });

const NAVY = '#0d1b2a';
const CYAN = '#5bc0eb';
const TEXT = '#f8f9fa';
const MUTED = '#9fb9cb';

const font = (file) => fs.readFileSync(path.join(pub, 'fonts', file)).toString('base64');
const fontCss = `
@font-face{font-family:'Montserrat';font-weight:500;src:url(data:font/woff2;base64,${font('montserrat-500.woff2')}) format('woff2')}
@font-face{font-family:'Montserrat';font-weight:700;src:url(data:font/woff2;base64,${font('montserrat-700.woff2')}) format('woff2')}
@font-face{font-family:'Montserrat';font-weight:900;src:url(data:font/woff2;base64,${font('montserrat-900.woff2')}) format('woff2')}
`;

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
${fontCss}
*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;background:${NAVY};font-family:'Montserrat',sans-serif;color:${TEXT};position:relative;overflow:hidden}
.bar{position:absolute;left:0;top:0;bottom:0;width:14px;background:${CYAN}}
.wrap{position:absolute;left:88px;right:88px;top:0;bottom:100px;display:flex;flex-direction:column;justify-content:center}
.eyebrow{font-weight:700;font-size:26px;letter-spacing:.14em;text-transform:uppercase;color:${CYAN};margin-bottom:26px}
.mark{font-weight:900;font-size:100px;line-height:1.05;letter-spacing:-.01em}
.mark span{color:${CYAN}}
.claim{font-weight:700;font-size:38px;line-height:1.3;color:${MUTED};margin-top:30px;max-width:900px}
.steps{position:absolute;left:88px;right:88px;bottom:56px;display:flex;justify-content:space-between;align-items:baseline;font-weight:500;font-size:26px;color:${MUTED}}
.steps b{color:${TEXT};font-weight:700}
</style></head><body>
<div class="bar"></div>
<div class="wrap">
  <div class="eyebrow">AI Governance for Healthcare</div>
  <div class="mark">Health <span>AI</span> Assurance</div>
  <div class="claim">KI im Gesundheitswesen einsetzen.<br>Verantwortung nachweisbar machen.</div>
</div>
<div class="steps"><span><b>Erfassen</b> · <b>Bewerten</b> · <b>Handeln</b> · <b>Überwachen</b></span><span>healthaiassurance.de</span></div>
</body></html>`;

// "HAA" as plain geometry so the favicon renders identically everywhere
// (SVG favicons can't load webfonts).
const letters = (fill) => `
  <path fill="${fill}" d="M4.5 20H9.2V29.8H16.8V20H21.5V44H16.8V34.2H9.2V44H4.5Z"/>
  <path fill="${fill}" fill-rule="evenodd" d="M23.5 44L29.4 20H34.6L40.5 44H35.3L34.4 40H29.6L28.7 44ZM32 30.6L30.8 35.5H33.2Z"/>
  <path fill="${fill}" fill-rule="evenodd" transform="translate(19 0)" d="M23.5 44L29.4 20H34.6L40.5 44H35.3L34.4 40H29.6L28.7 44ZM32 30.6L30.8 35.5H33.2Z"/>`;

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${NAVY}"/>${letters(CYAN)}
</svg>
`;
const touchSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${NAVY}"/>${letters(CYAN)}
</svg>`;

fs.writeFileSync(path.join(pub, 'favicon.svg'), faviconSvg);

async function renderSvg(browser, svg, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
  return buf;
}

function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

const browser = await chromium.launch();

const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await og.setContent(ogHtml);
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: path.join(pub, 'og', 'og-default.png'), clip: { x: 0, y: 0, width: 1200, height: 630 } });
await og.close();

const icoPngs = [];
for (const size of [16, 32, 48]) icoPngs.push({ size, buf: await renderSvg(browser, faviconSvg, size) });
fs.writeFileSync(path.join(pub, 'favicon.ico'), buildIco(icoPngs));
fs.writeFileSync(path.join(pub, 'apple-touch-icon.png'), await renderSvg(browser, touchSvg, 180));

await browser.close();
console.log('generated: og/og-default.png, favicon.svg, favicon.ico, apple-touch-icon.png');
