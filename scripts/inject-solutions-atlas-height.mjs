// Re-applies the postMessage height-reporting hook to
// public/embeds/solutions-atlas.html. Needed after any rebuild of that
// file from source (the CSS-recolor step regenerates it from the
// pristine source-files/ copy, which wipes out this hook -- a site-audit
// run against the live site is what caught this being missing once).
//
// Usage: node scripts/inject-solutions-atlas-height.mjs [path]
import fs from 'node:fs';

const target = process.argv[2] || 'public/embeds/solutions-atlas.html';
let html = fs.readFileSync(target, 'utf-8');

if (html.includes('haaReportHeightSoon')) {
  console.log('height script already present, nothing to do');
  process.exit(0);
}

const navFnOld =
  "function navigate(page){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+page));document.querySelectorAll('.nav-btn').forEach(x=>x.classList.toggle('active',x.dataset.page===page));$('sidebar').classList.remove('show');window.scrollTo({top:0,behavior:'smooth'});if(page==='explorer')renderProducts();if(page==='global')renderMetrics()}";
if (!html.includes(navFnOld)) {
  throw new Error('navigate() source not found verbatim -- aborting to avoid a silent no-op edit');
}
const navFnNew = navFnOld.slice(0, -1) + ';haaReportHeightSoon();}';
html = html.split(navFnOld).join(navFnNew);

const heightScript = `
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
// Insert before the first <script> tag (already after all body markup,
// and -- unlike incident-atlas -- nothing here calls navigate() synchronously
// on initial load, so placement is less critical, but keep it consistent).
const firstScriptTag = html.indexOf('<script>');
if (firstScriptTag === -1) throw new Error('no <script> tag found to insert before');
html = html.slice(0, firstScriptTag) + heightScript + html.slice(firstScriptTag);

fs.writeFileSync(target, html);
console.log('injected height-report script into', target, '- new size', html.length);
