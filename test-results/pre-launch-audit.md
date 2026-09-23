# Pre-Launch-Audit — Health AI Assurance

Werkzeuge: Playwright (echtes Chromium, kein rechnerischer/statischer Check), `@axe-core/playwright` als
WCAG-Kontrast-/A11y-Prüfer, Lighthouse (programmatic API) für Performance/A11y/Best-Practices/SEO.

Durchgeführt in zwei Phasen: (1) initialer Lauf gegen die Live-URL
(`http://toc0ux4krplbw3x8jaz9yb39.178.104.15.59.sslip.io/`), fand 5 echte Bugs; (2) Fix-Iteration + erneute
Verifikation lokal gegen den identischen Build (schnellere Iteration), abschließend erneut gegen die Live-URL
bestätigt. Rohdaten: `site-audit-raw.json`, `axe-detail.json`, `lighthouse-summary.json`,
`lighthouse-<route>.json`. Screenshots: `screenshots/<route>-<1440|375>.png`.

## Kritische Blocker — gefunden UND in diesem Durchlauf behoben

1. **JS-Laufzeitfehler auf `/incident-atlas`**: `haaReportHeightSoon is not defined`, geworfen bei jedem
   Seitenaufruf (Playwright `pageerror`-Event). Ursache: das Höhen-Report-Skript wurde nach `</body>`
   eingefügt, aber das Hauptskript ruft `filter()` — und damit den darin gehookten Höhen-Report — bereits
   synchron beim initialen Laden auf, bevor das zweite `<script>`-Tag überhaupt geparst ist. Fix: Höhen-Skript
   jetzt vor dem Hauptskript eingefügt (`scripts/inject-incident-height.js` korrigiert, Embed neu gebaut).
   Verifiziert: keine Konsolenfehler mehr auf irgendeiner Seite/Breite.

2. **Systemischer Kontrastfehler, 265 Elemente auf 5 Seiten**: axe-core maß `#9bb5c8` (--color-text-muted)
   auf `#1b4965` (--color-card) mit **4.49:1** — knapp unter 4.5:1 (meine frühere Handrechnung kam auf 4.50,
   exakt an der Kippgrenze). Betraf Startseite, Lösung, Buch sowie beide Atlanten (dort dieselbe Farbpaarung).
   Fix: `--color-text-muted` zentral auf `#9fb9cb` angehoben (4.70:1), in `global.css` und beiden
   Atlas-Embeds. Verifiziert: 0 `color-contrast`-Verstöße auf allen 5 betroffenen Seiten.

3. **Solutions Atlas, sekundärer Button**: `.btn.secondary` (Cyan-Text auf 12%-transparentem Cyan-Hintergrund)
   maß 3.78:1. Fix: Hintergrund auf `transparent` gesetzt (Text bleibt Akzentfarbe, jetzt gegen die
   tatsächliche Kartenfläche gemessen: 4.66:1).

4. **Buchcover wird sichtbar verzerrt dargestellt** (`/buch`): `.book-cover{width:100%}` ohne `height:auto`
   ließ die Höhe am HTML-`height`-Attribut (281px) hängen, während die Breite auf bis zu 320px gestreckt
   wurde — Lighthouse maß ein gerendertes Seitenverhältnis von 1.07 statt der echten 0.71 (also spürbar zu
   breit/gestaucht). Fix: `height: auto` ergänzt. Verifiziert: Lighthouse `image-aspect-ratio` jetzt PASS.

5. **Solutions-Atlas-Regression während dieses Audits selbst verursacht und wieder gefangen**: Beim
   Neu-Bauen der Embed-Datei für Fix #2/#3 (aus der Quelldatei) ging das postMessage-Höhen-Skript verloren,
   da es bisher nur als Einmal-Befehl existierte, nicht als wiederholbares Skript. Ergebnis: iframe blieb auf
   der 640px-Fallback-Höhe stehen, echter Inhalt 2380–4473px hoch → doppeltes Scrollen wäre wieder aufgetreten.
   Gefangen durch denselben Höhenvergleich, der auch das ursprüngliche Problem bestätigt hatte. Fix:
   `scripts/inject-solutions-atlas-height.mjs` neu angelegt (wiederholbar, nicht mehr Einmal-Befehl) und
   erneut angewendet. Verifiziert: `noDoubleScroll: true` bei 375px UND 1440px für beide Atlanten.

## Kleinere Fehler — können nachgezogen werden

- **Login-Link (`https://app.healthaiassurance.de`)**: Der Link selbst ist korrekt konfiguriert, aber die
  Subdomain liefert aktuell HTTP 404 bzw. bei HTTPS einen nicht vertrauenswürdigen Zertifikatsfehler
  (`SEC_E_UNTRUSTED_ROOT`) — auflösend auf dieselbe Server-IP wie die sslip.io-Vorschau, aber offenbar noch
  ohne konfigurierten vHost/TLS. Kein Code-Bug in diesem Repo, aber ein Nutzer, der jetzt auf "Login für
  Bestandskunden" klickt, landet auf einer kaputten Seite. Vor Go-Live mit Peter klären.
- **Buchcover niedrig aufgelöst**: Quelldatei ist nur 200×281px, wird aber bis 320px CSS-Breite angezeigt
  (Lighthouse `image-size-responsive`, weiterhin FAIL, `/buch` Best-Practices dadurch bei 96 statt 100).
  Braucht eine höher aufgelöste Cover-Datei von Peter — kein Code-Fix möglich ohne besseres Ausgangsbild.
- **Bekannte offene TODOs** (unverändert seit früheren Commits, keine neuen Funde): `TODO_MEDHOCHZWEI_URL`
  auf `/buch`, LinkedIn-Platzhalter-URL im Autor-Trust-Block und in `ContactCta`.
- **Vorbestehende A11y-Strukturprobleme innerhalb der beiden eingebetteten Atlas-Dateien** (nicht durch unsere
  Einbettung verursacht, Teil des Original-Inhalts): `heading-order` (h3 ohne vorangehende h2 in einer
  Sidebar-Karte, beide Atlanten), `landmark-unique` (mehrdeutige Landmarks durch verschachtelte
  iframe-Struktur, beide Atlanten), `nested-interactive` (serious, nur Incident Atlas: die
  SVG-Visualisierung `#atlas` enthält fokussierbare Kind-Elemente in einem interaktiven Container).

## Bestätigt und in Ordnung

- **Alle 8 Routen** (`/`, `/loesung`, `/buch`, `/incident-atlas`, `/quick-check`, `/solutions-atlas`,
  `/impressum`, `/datenschutz`) rendern bei 1440px und 375px ohne horizontales Overflow, ohne abgeschnittenen
  Text, ohne überlappende Elemente (Screenshots liegen bei).
- **Kein doppeltes Scrollen** bei 375px in beiden iframe-Einbettungen — mit echten Messwerten bestätigt
  (Wrapper-Höhe vs. `document.documentElement.scrollHeight` im iframe, Differenz jeweils ≤2px).
- **WCAG-AA-Kontrast**: 0 `color-contrast`-Verstöße auf allen 5 geprüften Seiten (axe-core), inkl. beider
  Atlas-Badge-Sets und des neuen Amber-Referenzkunden-Stickers.
- **Alle internen Links** (Nav, Footer, CTAs, "Mehr erfahren") liefern 200 — echte HTTP-Requests, nicht nur
  Code-Inspektion.
- **Alle mailto-Links** zeigen korrekt auf `info@peter-langkafel.de`.
- **Externer Link zu peter-langkafel.de** erreichbar (200).
- **robots.txt und sitemap-index.xml** beide erreichbar (200).
- **Keine Google-Fonts-Netzwerkaufrufe** auf irgendeiner Seite/Breite — per echtem Netzwerk-Mitschnitt
  bestätigt (nicht nur Quellcode-Grep).
- **Meta-Tags** (Title, Description, OG-Tags, Canonical-URL) auf jeder Seite vorhanden und seitenspezifisch
  korrekt.
- **Quick Check**: vollständiger Durchlauf aller 12 Fragen, Auswertungsbildschirm erscheint mit
  Ergebnis+Datum, "Nochmal versuchen" setzt korrekt zurück — keine Konsolenfehler.
- **Solutions Atlas**: Tab-Wechsel, Freitextsuche (1.614 → 1.230 Treffer bei "Radiology"),
  Dropdown-Filter (1.614 → 30 Treffer bei "Anästhesiologie"), Pagination (Zeileninhalt ändert sich beim
  Weiterblättern) — alle mit echten Vorher/Nachher-Werten verifiziert.
- **Incident Atlas**: Suchfilter (41 → 4 Treffer bei "FDA"), Kind-Tab-Wechsel, Fallakte-Modal (natives
  `<dialog>`) öffnet und schließt korrekt.
- **Lighthouse**: Accessibility 100 und SEO 100 auf jeder Seite. Best Practices 100 auf 7/8 Seiten (96 auf
  `/buch`, siehe Cover-Auflösung oben). Performance 86–93 auf allen Seiten (solide, LCP durchgehend
  ≤1.8s, CLS 0).
