# Tests und Audits

Es gibt **keine Unit-Tests**. Geprüft wird mit echten Browsern (Playwright/Chromium) gegen einen laufenden
Server: axe-core für Barrierefreiheit, Lighthouse für Performance, eigene Skripte für Verhalten. Grund: Die
gefundenen Fehler waren durchweg Laufzeit-/Rendering-Fehler (Astro-Style-Scoping, Kontrast, Layout-Shift,
iframe-Höhe), die ein Blick in den Quelltext nicht zeigt — mehrere davon traten **nur** auf der Live-URL unter
echter Latenz auf.

## Voraussetzungen

```sh
npm install
npx playwright install chromium          # einmalig
npm run build && npm run preview -- --port 4322      # lokal prüfen, oder eine Live-URL nehmen
```

Die Skripte lesen die Ziel-URL aus der Umgebungsvariable `BASE_URL` (Beispiele in PowerShell:
`$env:BASE_URL="http://localhost:4322"; node scripts/site-audit.mjs`). Ausgaben landen in `test-results/`;
Screenshots und `*.json` sind git-ignoriert, `*.md`-Berichte werden versioniert.

## Skripte

| Skript | Zweck | Aufruf |
| --- | --- | --- |
| `scripts/site-audit.mjs` | Umfassender Lauf: alle 8 Inhalts-Routen bei 1440 und 375 px (Screenshots), Konsolenfehler, Links, Meta-Tags, axe-Prüfung, Quick Check komplett durchspielen (Fragenzahl dynamisch), Atlas-Interaktivität, alle Requests (Fremd-Hosts?). | `BASE_URL=… node scripts/site-audit.mjs` |
| `scripts/axe-detail.mjs` | Nachlauf: volle axe-Verstöße mit Knoten, Selektoren, gemessenen Farben — für Seiten, die im Hauptlauf auffielen. | `BASE_URL=… node scripts/axe-detail.mjs` |
| `scripts/css-leak-check.mjs` | **CSS-Leak-Check:** vergleicht berechnete Stile von `/` und `/buch` vor und nach einem Besuch von `/quick-check` in derselben Sitzung. Schutz vor Scope-Lecks ([ADR 4](decisions.md)). | `BASE_URL=… node scripts/css-leak-check.mjs` |
| `scripts/incident-atlas-audit.mjs` | Badge-Kontrast (echte berechnete Farben), `:root`-Variablen des Embeds, **iframe-Höhe bei 375 px ohne doppelten Scrollbalken**. | `npm run audit:incident-atlas` |
| `scripts/quick-check-15-audit.mjs` | Spielt den 15-Fragen-/5-Antworten-Quick-Check durch (fest auf 15 kodiert — bei Änderung der Fragenzahl mit anpassen). | `BASE_URL=… node scripts/quick-check-15-audit.mjs` |
| `scripts/lighthouse-live-audit.mjs` | Lighthouse Mobile + Desktop für alle 8 Routen gegen eine Live-URL, plus Zeit bis sichtbarer iframe-Inhalt (Lighthouse selbst misst das nicht). **Maßgeblich für Performance.** | `BASE_URL=https://… node scripts/lighthouse-live-audit.mjs` |
| `scripts/lighthouse-audit.mjs` | Ältere, lokale Lighthouse-Variante (Standardport 4322). Für Live-Werte nicht verwenden — Localhost verschweigt Latenz-Effekte (Font-Swap-CLS). | `node scripts/lighthouse-audit.mjs` |
| `scripts/generate-brand-assets.mjs` | Kein Test: erzeugt OG-Image, Favicon und Apple-Touch-Icon mit Playwright und den selbst gehosteten Schriften. | `node scripts/generate-brand-assets.mjs` |
| `scripts/build-embeds.mjs` | Kein Test: baut die Atlas-Embeds aus `source-files/`; siehe [ADR 2/3](decisions.md). | `node scripts/build-embeds.mjs` |

## Letzte Ergebnisse

Nicht hier dupliziert (veraltet sofort). Maßgeblich:

- **`test-results/pre-launch-audit.md`** — erster Lauf: fünf Blocker gefunden und behoben.
- **`test-results/pre-launch-audit-v2.md`** — Regressionslauf gegen die Live-URL plus Nachtrag zur
  CLS-Korrektur (Montserrat 900, [ADR 5](decisions.md)). Dort auch die offenen, nicht behobenen Befunde
  (Server-Header, Lighthouse-Desktop-Schwankung, Restfunde innerhalb der Atlanten).
- Ergänzend: `test-results/lighthouse-performance-live.md`, `test-results/incident-atlas-contrast.md`.

Hinweis zur Interpretation: Lighthouse-Werte schwanken von Lauf zu Lauf deutlich (Desktop-Performance
wurde zwischen ~76 und ~97 gemessen). Einzelwerte nie als Regression werten; mehrfach messen. axe-core kann
an der 4,5:1-Grenze von einer Handrechnung abweichen — **axe gilt**.

## Wann was erneut laufen lassen

Nach **größeren Inhalts- oder Layoutänderungen** den kompletten Satz gegen die Live-URL (erst nach bestätigtem
Deploy, siehe [architecture.md](architecture.md)): `site-audit` → `axe-detail` bei Funden →
`lighthouse-live-audit`.

Gezielt:

| Änderung | Pflichtprüfung |
| --- | --- |
| Alles am **Quick Check** (Styles, Markup, Fragen) | **`css-leak-check.mjs`** (Scope-Lecks) und `quick-check-15-audit.mjs` |
| Neue Atlas-Rohdatei oder Änderung an `scripts/embeds/*.dark.css` / `build-embeds.mjs` | **postMessage-Höhencheck** (siehe unten) auf beiden Atlanten, außerdem `incident-atlas-audit.mjs` und axe |
| Änderung von Tokens (`global.css`), insbesondere Text-/Akzentfarben | axe auf allen Seiten **und** Abgleich der Embed-Stylesheets (Literalwerte, [ADR 2](decisions.md)) |
| Schriften/Preloads/`font-display` | Live-Lighthouse (CLS auf `/buch`, `/`); lokal nicht aussagekräftig |
| Neue Seite oder neue Links | `site-audit` (Links, Meta, Konsole, Sitemap) |

### Der postMessage-Höhencheck

Es gibt dafür kein eigenes Skript; abgedeckt ist er durch `site-audit.mjs` (Atlas-Seiten: Wartezeit für die
Höhen-Synchronisation, dann Vergleich Wrapper-Höhe vs. Inhaltshöhe) und `incident-atlas-audit.mjs` (375 px, kein
doppelter Scrollbalken). Manuell in jedem Fall prüfen, weil er still ausfallen kann ([ADR 3](decisions.md)):

1. `/solutions-atlas` und `/incident-atlas` öffnen; **die Seite scrollt, das iframe nicht** (kein zweiter
   Balken), auch bei 375 px.
2. Tab bzw. Filter wechseln, Suche eingeben: der Wrapper passt sich an; unter dem Inhalt kein leerer Streifen,
   kein Abschneiden.
3. Konsole: kein `haaReportHeightSoon is not defined`.
4. Bleibt der Wrapper bei ~640 px stehen, fehlt die Höhen-Injektion im Embed → `build-embeds.mjs` erneut
   ausführen.

## Bekannte Grenzen der Skripte

- Playwright-`fullPage`-Screenshots erzeugen bei sticky Header Stitching-Artefakte; die Skripte nutzen hohe
  Viewports. Artefakte ≠ Seitenfehler.
- Screenshots und JSON entstehen bei jedem Lauf neu und sind nicht versioniert; ein Bericht muss als `.md`
  bewusst geschrieben werden.
- Es wird kein Screenreader-Test durchgeführt; axe deckt nur den automatisierbaren Teil ab.
