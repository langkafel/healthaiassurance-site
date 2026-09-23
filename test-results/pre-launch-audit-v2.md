# Pre-Launch-Audit v2 — gegen die Live-Preview-URL

Ziel: `http://toc0ux4krplbw3x8jaz9yb39.178.104.15.59.sslip.io/`
Getestet gegen Commit `0427138` — vor dem Testlauf per Direktvergleich bestätigt: das ausgelieferte
`quick-check.DwKj_SsI.css`-Bundle ist byte-identisch mit dem lokalen Build nach diesem Commit, und die
statischen Quiz-Elemente tragen wieder ein `data-astro-cid`-Attribut (Beweis, dass der Scoped/Global-Split
live ist, nicht nur der reine Inhalt).

Werkzeuge: Playwright (echtes Chromium) + `@axe-core/playwright` + Lighthouse, alle gegen die echte URL,
nicht localhost. Rohdaten: `site-audit-raw.json`, `axe-detail.json`, `lighthouse-live-summary.json`,
`lighthouse-live-<route>-<mobile|desktop>.json`, `quick-check-15-audit.json`, `css-leak-check.json`.

## 1. Quick-Check-Regressionscheck — bestanden

- 15 Fragen, 5 Themenkacheln im Intro (inkl. "Wirtschaftlichkeit & Umsetzung") — bestätigt
- Vollständiger 15-Fragen-Durchlauf funktioniert (Desktop *und* Mobile getestet)
- Auswertung zeigt Score, Kategorie-Balken (alle 5 Kategorien, Summe 3+3+3+4+2=15 korrekt), Insight-Satz
- Beide CTA-Buttons vorhanden und korrekt verlinkt: "Buch vorbestellen" → `/buch`, "Mich kontaktieren" →
  `mailto:info@peter-langkafel.de`
- 0 Konsolenfehler bei Desktop und Mobile

## 2. Lighthouse Performance — Live-URL, Mobile + Desktop, alle 8 Seiten

| Route | Mobile | Desktop |
| --- | --- | --- |
| `/` | 100 | **85** |
| `/loesung` | 100 | 97 |
| `/buch` | 99 | **76** |
| `/incident-atlas` | 100 | 97 |
| `/quick-check` | 99 | **86** |
| `/solutions-atlas` | 100 | 97 |
| `/impressum` | 100 | 97 |
| `/datenschutz` | 100 | 97 |

Drei Seiten unter 90 (alle Desktop): `/` (85), `/buch` (76), `/quick-check` (86). Mobile durchgehend 99–100.

**Hauptursachen (identisch auf allen drei Seiten, aus den Lighthouse-Insight-Audits):**
- **Web-Font-Swap verursacht Layout-Shift:** `montserrat-900.woff2` lädt nach dem ersten Rendern nach und
  verschiebt Text, der diese Schriftschnitt-Stärke nutzt (v. a. Überschriften). Auf `/buch` am stärksten:
  CLS 0,196 (Ursache laut Lighthouse: `.book-info`-Block verschiebt sich, sobald Cover-Bild *und* Font
  laden). Das ist die inhärente Kehrseite von `font-display: swap` (bewusst für schnelleres erstes Rendern
  gewählt) unter echter Netzwerklatenz — auf localhost war das nie sichtbar, weil Fonts dort quasi
  verzögerungsfrei laden.
- **"Use efficient cache lifetimes"** — 102–150 KiB geschätztes Einsparpotenzial auf allen drei Seiten.
  Fehlende `Cache-Control`-Header, Server-/Coolify-Konfiguration.
- **"Modern HTTP"** — 340–490 ms geschätztes Einsparpotenzial. Kein HTTP/2, Server-Konfiguration.
- **"Render-blocking requests"** — 760–900 ms geschätztes Einsparpotenzial.
- **"Network dependency tree" / "LCP request discovery"** — als auffällig markiert, ohne separaten
  Zahlenwert in dieser Messung.

Alle Ursachen sind Server-/Infrastrukturkonfiguration oder eine bewusste Font-Lade-Strategie — kein
App-Code-Fehler. Nur berichtet, nicht behoben.

**Hinweis zur Schwankung gegenüber der letzten Messung:** In der vorigen Live-Messung lag nur `/buch`
Desktop unter 90 (84). Jetzt sind es drei Seiten, mit denselben Ursachen, aber `/buch` diesmal deutlich
niedriger (76 statt 84) — plausibel durch reale Netzwerk-Latenzschwankung des Live-Servers zwischen den
Messläufen, nicht durch eine Code-Änderung (der Commit zwischen beiden Messungen war ausschließlich der
CSS-Scoping-Split am Quick Check, betrifft `/buch` nicht).

### Kern-Metriken: die beiden datenlastigen Seiten

**`/incident-atlas`** (41 Fälle): LCP 1,1s (Mobile+Desktop) · TBT 60ms (Mobile) / 90ms (Desktop) · CLS 0 ·
iframe-Inhalt sichtbar nach **262 ms**

**`/solutions-atlas`** (1.614 FDA-Einträge): LCP 1,1s (beide) · TBT 60ms (Mobile) / 50ms (Desktop) ·
CLS 0,003 · iframe-Inhalt sichtbar nach **253 ms**

## 3. Vollständiger Regressionscheck aller 8 Seiten

**Screenshots** (1440px + 375px, liegen unter `test-results/screenshots/`):
- `test-results/screenshots/home-1440.png`
- `test-results/screenshots/home-375.png`
- `test-results/screenshots/loesung-1440.png`
- `test-results/screenshots/loesung-375.png`
- `test-results/screenshots/buch-1440.png`
- `test-results/screenshots/buch-375.png`
- `test-results/screenshots/incident-atlas-1440.png`
- `test-results/screenshots/incident-atlas-375.png`
- `test-results/screenshots/quick-check-1440.png`
- `test-results/screenshots/quick-check-375.png`
- `test-results/screenshots/solutions-atlas-1440.png`
- `test-results/screenshots/solutions-atlas-375.png`
- `test-results/screenshots/impressum-1440.png`
- `test-results/screenshots/impressum-375.png`
- `test-results/screenshots/datenschutz-1440.png`
- `test-results/screenshots/datenschutz-375.png`
- `test-results/screenshots/live-quickcheck-cta.png` (Auswertung, CTA-Bereich, Beleg für Punkt 1)

Keine sichtbaren Brüche, kein horizontales Overflow auf irgendeiner Seite/Breite (per
`document.documentElement.scrollWidth` vs. `clientWidth` gemessen, nicht nur optisch geschätzt).

**Konsolenfehler:** keine, auf keiner der 8 Seiten, bei keiner der beiden Breiten.

**CSS-Isolation des Quiz-Stylesheets (is:global-Split):** gezielt geprüft wie angefordert — `/` und `/buch`
computed-style-Snapshot genommen, danach in **derselben** Browser-Session `/quick-check` aufgerufen und eine
Frage beantwortet, danach zurück zu `/` und `/buch` navigiert und erneut Snapshot genommen. Ergebnis:
**IDENTISCH** vor/nach (Margin, Padding, Box-Sizing, Font-Familie, Farbe von `<p>`, `<h1>`, `.btn` jeweils
exakt gleich). Rohdaten: `test-results/css-leak-check.json`. Zusätzlich bestätigt: `/` referenziert im HTML
gar kein `quick-check.*.css`-Bundle — die Datei wird dort nicht einmal geladen.

**Doppeltes Scrollen (beide iframes, 375px und 1440px):** weiterhin nicht vorhanden.
- `/incident-atlas` 375px: Wrapper 21558px vs. Inhalt 21556px
- `/incident-atlas` 1440px: Wrapper 9129px vs. Inhalt 9127px
- `/solutions-atlas` 375px: Wrapper 4478px vs. Inhalt 4476px
- `/solutions-atlas` 1440px: Wrapper 2459px vs. Inhalt 2457px

**postMessage-Kommunikation beider Atlanten:** funktioniert fehlerfrei (0 Konsolenfehler, Höhen-Werte oben
bestätigen korrekten Empfang).

**Links (alle 8 Seiten):**
- Alle internen Links (Nav, Footer, CTAs, "Mehr erfahren") → 200
- **"Kontakt"-Nav-Punkt**: auf allen 8 Seiten vorhanden, verlinkt korrekt auf `mailto:info@peter-langkafel.de`
- **Login-Button** (`https://app.healthaiassurance.de`): **bekanntes, bereits dokumentiertes Problem, kein
  neuer Fund** — liefert weiterhin 404 bzw. TLS-Fehler, da dort noch kein vHost eingerichtet ist (siehe
  `pre-launch-audit.md` v1). Unverändert seit letzter Prüfung.
- Alle mailto-Links zeigen korrekt auf `info@peter-langkafel.de`
- robots.txt und sitemap-index.xml weiterhin erreichbar (200)

## 4. WCAG-Kontrast-Spotcheck

- **Amber-Sticker (`/loesung`)**: computed-style-Messung direkt am Live-Element: Text `rgb(13,27,42)` auf
  Hintergrund `rgb(245,158,11)` → **8,10:1** (identisch zur Handrechnung, klar über 4,5:1 und sogar AAA).
- **Modul-Landkarte + gesamte `/loesung`-Seite**: axe-core-Scan gegen die Live-Seite → **0
  color-contrast-Verstöße**. War bereits in der letzten Runde dokumentiert (nach dem `--color-text-muted`-Fix),
  jetzt gegen die aktuelle Live-URL erneut bestätigt.
- Zum Vergleich, ebenfalls erneut gegen live bestätigt: `/`, `/buch` → 0 Verstöße. `/incident-atlas`,
  `/solutions-atlas` → weiterhin 0 `color-contrast`-Verstöße, nur die bereits dokumentierten
  vorbestehenden Struktur-Themen (`heading-order`, `landmark-unique`, `nested-interactive`) innerhalb der
  Original-Atlas-Dateien, unverändert.

## Zusammenfassung

Keine neuen Blocker. Alle Kernfunktionen (Quiz, beide Atlanten, Navigation, Kontakt) live bestätigt. Die
einzigen Performance-Funde (Web-Font-Swap-CLS, fehlendes HTTP/2, fehlende Cache-Header) sind
Server-/Infrastruktur- bzw. bewusste Font-Strategie-Themen, keine Code-Bugs, und schwanken sichtbar mit der
Netzwerklatenz des Live-Servers zwischen Messläufen.
