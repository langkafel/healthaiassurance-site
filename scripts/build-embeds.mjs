// Regenerates public/embeds/{solutions-atlas,incident-atlas}.html from the
// untouched originals in source-files/. See docs/decisions.md (ADR 1-3).
//
//   node scripts/build-embeds.mjs
//
// Pipeline per embed:
//   1. Replace the original <style> block with the dark-theme stylesheet in
//      scripts/embeds/*.dark.css (every color mapped to the design tokens).
//   2. Patch the few colors that live in JS/HTML instead of CSS.
//   3. Inject the postMessage height reporter (see EmbedFrame.astro for the
//      receiving side), hooked into the function that changes the visible
//      content, and placed BEFORE the first <script> tag.
//
// Run this after editing a *.dark.css file or replacing a source file. The
// output is deterministic; `git diff public/embeds` shows exactly what changed.
// Skipping step 3 (or rebuilding by hand) silently drops the height sync and
// brings back the double-scrollbar -- that already happened once.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf-8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

// Message contract with src/components/EmbedFrame.astro: {type, height}.
const HEIGHT_SCRIPT = `
<script>
(function(){
  function haaReportHeight(){
    var h = document.documentElement.scrollHeight;
    window.parent.postMessage({type:'haa-atlas-height', height:h}, '*');
  }
  function haaReportHeightSoon(){
    haaReportHeight();
    setTimeout(haaReportHeight, 60);
    setTimeout(haaReportHeight, 300);
  }
  window.haaReportHeightSoon = haaReportHeightSoon;
  window.addEventListener('load', haaReportHeightSoon);
  window.addEventListener('resize', haaReportHeightSoon);
  if ('ResizeObserver' in window) {
    new ResizeObserver(haaReportHeightSoon).observe(document.body);
  }
  if (document.readyState === 'complete') haaReportHeightSoon();
})();
</script>
`;

function replaceExactlyOnce(html, oldStr, newStr, label) {
  const n = html.split(oldStr).length - 1;
  if (n === 0) throw new Error(`[${label}] expected text not found (source file changed?): ${oldStr.slice(0, 70)}`);
  return html.split(oldStr).join(newStr);
}

function swapStyle(html, cssPath) {
  const css = read(cssPath);
  if (!/<style>[\s\S]*?<\/style>/.test(html)) throw new Error('no <style> block in source');
  return html.replace(/<style>[\s\S]*?<\/style>/, () => '<style>' + css + '</style>');
}

// The height script must exist before the page's own script runs: incident-
// atlas calls filter() synchronously at load, and the hook inside it needs
// haaReportHeightSoon to be defined already (appending at </body> threw
// "haaReportHeightSoon is not defined" on every page load).
function injectHeightScript(html, hookOld, hookLabel) {
  const hookNew = hookOld.slice(0, -1) + ';haaReportHeightSoon();}';
  html = replaceExactlyOnce(html, hookOld, hookNew, hookLabel);
  const first = html.indexOf('<script>');
  if (first === -1) throw new Error('no <script> tag to insert before');
  return html.slice(0, first) + HEIGHT_SCRIPT + html.slice(first);
}

// ---- Solutions Atlas (FDA products) -------------------------------------
{
  let html = read('source-files/KI_Medizinprodukte_Interaktiver_Atlas.html');
  html = swapStyle(html, 'scripts/embeds/solutions-atlas.dark.css');
  html = replaceExactlyOnce(html, 'stroke="#e6eeee"', 'stroke="#243d55"', 'solutions gridline');
  html = replaceExactlyOnce(
    html,
    '<meta name="color-scheme" content="light">',
    '<meta name="color-scheme" content="dark">',
    'solutions color-scheme'
  );
  // Hook: navigate() switches the visible tab (Übersicht/FDA/International/Quellen).
  html = injectHeightScript(
    html,
    "function navigate(page){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+page));document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('sidebar').classList.remove('show');window.scrollTo({top:0,behavior:'smooth'});if(page==='explorer')renderProducts();if(page==='global')renderMetrics()}",
    'solutions navigate()'
  );
  write('public/embeds/solutions-atlas.html', html);
  console.log('solutions-atlas.html', html.length, 'bytes, records:', (html.match(/"id":/g) || []).length);
}

// ---- Incident Atlas -----------------------------------------------------
{
  let html = read('source-files/Health_AI_Incident_Failure_Atlas_ERWEITERT_41_2026-09-23.html');
  html = swapStyle(html, 'scripts/embeds/incident-atlas.dark.css');
  // Colors hardcoded in the SVG chart script (category dots, rings, labels).
  const patches = [
    ["COLORS={real:'#58c4e8',reported:'#f6c16b',experimental:'#ec91aa'}", "COLORS={real:'#5bc0eb',reported:'#f59e0b',experimental:'#f472b6'}"],
    ["stroke:'#203d53'", "stroke:'#243d55'"],
    ["stroke:'#30485c'", "stroke:'#243d55'"],
    ["fill:'#819aab'", "fill:'#9fb9cb'"],
    ["fill:'#c7ecf8'", "fill:'#5bc0eb'"],
    ["fill:'#a2b9c9'", "fill:'#9fb9cb'"],
  ];
  for (const [a, b] of patches) html = replaceExactlyOnce(html, a, b, 'incident chart color');
  // Hook: filter() is the single funnel for search, selects, tabs and reset.
  html = injectHeightScript(
    html,
    "function filter(){let q=$('q').value.trim().toLocaleLowerCase('de');let sector=$('sector').value,mode=$('mode').value,grade=$('grade').value[0]||'',source=$('source').value;shown=DATA.filter(x=>(active==='all'||x.kind===active)&&(!sector||x.sector===sector)&&(!mode||x.mode===mode)&&(!grade||x.grade===grade)&&(!source||(source==='linked'?!!x.sources.length:!x.sources.length))&&(!q||[x.id,x.title,x.desc,x.sector,x.country,x.mode,x.sourceLabel].join(' ').toLocaleLowerCase('de').includes(q)));$('resultCount').textContent=`${shown.length} von ${DATA.length} Einträgen · ${shown.filter(x=>x.sources.length).length} mit direktem Quellenlink`;renderCards();renderAtlas()}",
    'incident filter()'
  );
  write('public/embeds/incident-atlas.html', html);
  console.log('incident-atlas.html', html.length, 'bytes, cases:', (html.match(/"id":"/g) || []).length);
}
