# Lighthouse Performance — Live-URL (Mobile + Desktop)

Gemessen gegen `http://toc0ux4krplbw3x8jaz9yb39.178.104.15.59.sslip.io/` (echte Coolify-Preview, nicht
localhost), nach Bestätigung dass der Build aktuell ist (Commit `c5bbaff`). Werkzeug: Lighthouse
(programmatic API) über Playwright-Chromium, Standard-Mobile-Preset (4x CPU-Drosselung, simuliertes
langsames 4G) und Standard-Desktop-Preset (kein Screen-Emulation, keine zusätzliche Drosselung).

Rohdaten: `lighthouse-live-<route>-<mobile|desktop>.json`, Zusammenfassung: `lighthouse-live-summary.json`.

## Performance-Score pro Seite

| Route | Mobile | Desktop |
| --- | --- | --- |
| `/` | 96 | 94 |
| `/loesung` | 100 | 97 |
| `/buch` | 100 | **84** |
| `/incident-atlas` | 100 | 97 |
| `/quick-check` | 100 | 95 |
| `/solutions-atlas` | 99 | 97 |
| `/impressum` | 100 | 97 |
| `/datenschutz` | 100 | 92 |

Niedrigster Wert: **84** (`/buch`, Desktop). Höchster Wert: **100** (mehrere Seiten, durchgehend Mobile).
Einzige Seite unter 90: `/buch` Desktop — siehe Ursachenanalyse unten.

**Vergleich zu den früheren lokalen Werten (86–93, ein Wert pro Seite, Preset damals nicht dokumentiert):**
Die lokalen Werte lagen näher an den jetzigen *Desktop*-Werten (86–97) als an den Mobile-Werten (96–100) —
die früheren Zahlen waren also vermutlich versehentlich das Desktop-Preset, nur ohne Beschriftung. Gegenüber
lokal hat sich nichts dramatisch verschoben, mit einer Ausnahme: `/buch` Desktop fiel von 86 (lokal) auf 84
(live) — im Rahmen der Messschwankung einer echten Netzwerkverbindung, aber die Kernursache (siehe unten)
ist dieselbe wie schon lokal vermutet: die Anfrage-Latenz zum echten Server macht sich stärker bemerkbar als
bei localhost mit praktisch 0ms Latenz.

## Kern-Metriken: die beiden datenlastigen Seiten

### `/incident-atlas` (41 Fälle)

| | Mobile | Desktop |
| --- | --- | --- |
| LCP | 1.1 s | 1.1 s |
| TBT (Lab-Proxy für INP) | 80 ms | 60 ms |
| CLS | 0 | 0 |
| FCP | 0.8 s | 0.8 s |
| Speed Index | 0.9 s | 0.8 s |

**Zeit bis iframe-Inhalt sichtbar** (separat per Playwright gemessen, nicht Teil von Lighthouse: Navigation
bis das erste `.case`-Element im iframe sichtbar ist): **319 ms**.

### `/solutions-atlas` (1.614 FDA-Einträge)

| | Mobile | Desktop |
| --- | --- | --- |
| LCP | 1.6 s | 1.1 s |
| TBT (Lab-Proxy für INP) | 50 ms | 50 ms |
| CLS | 0.003 | 0.003 |
| FCP | 1.4 s | 0.8 s |
| Speed Index | 1.4 s | 1.1 s |

**Zeit bis iframe-Inhalt sichtbar**: **250 ms**.

Beide Werte deutlich unter einer Sekunde — die Datenmenge (1.614 bzw. 41 Einträge, beide vollständig
client-seitig im iframe eingebettet, kein Nachladen) wirkt sich auf die reine Sichtbarkeitszeit praktisch
nicht spürbar aus.

## Ursachenanalyse: `/buch` Desktop (84, einzige Seite < 90)

Lighthouse-Metrik-Scores (nicht der Gesamtscore, sondern die Einzelbewertung, die ihn zusammensetzt):

- First Contentful Paint: 1.5 s → Metrik-Score 0.54 (schwach)
- Largest Contentful Paint: 2.0 s → Metrik-Score 0.63 (schwach)
- Speed Index: 1.5 s → Metrik-Score 0.82
- Total Blocking Time: 0 ms → Metrik-Score 1.0 (unauffällig)
- Cumulative Layout Shift: 0.011 → Metrik-Score 1.0 (unauffällig)

Von Lighthouse genannte Hauptursachen (Insights-Audits, jeweils mit geschätzter Einsparung):

- **"Use efficient cache lifetimes"** — geschätzte Einsparung 133 KiB. Statische Assets (Fonts, Bilder,
  CSS/JS) werden ohne lange `Cache-Control`-Lebensdauer ausgeliefert → Server-/Coolify-Konfiguration, kein
  App-Code.
- **"Modern HTTP"** — geschätzte Einsparung 570 ms. Deutet auf fehlendes HTTP/2 (bzw. HTTP/3) auf dem
  Server hin → ebenfalls Server-/Reverse-Proxy-Konfiguration.
- **"Render-blocking requests"** — geschätzte Einsparung 830 ms.
- **"LCP request discovery"** und **"Network dependency tree"** — beide als auffällig markiert, ohne
  Lighthouse-eigenen Zahlenwert in dieser Messung; deuten auf eine nicht-optimale Ladereihenfolge bis zum
  LCP-Element (dem Buchcover) hin.

Alle vier Punkte betreffen Server-/Infrastrukturkonfiguration (Caching-Header, HTTP-Version,
Ladereihenfolge) und nicht den Astro-Code selbst — wie gewünscht nur berichtet, nicht behoben.

## Hinweis zur Preset-Frage

Beide Presets jetzt sauber getrennt gemessen und beschriftet (Mobile: Standard-DevTools-Mobile-Emulation
mit 4x-CPU-Drosselung + simuliertem langsamen 4G; Desktop: `screenEmulation: disabled`, keine künstliche
Drosselung). Mobile schnitt auf dieser Seite durchgehend gleich gut oder besser ab als Desktop — plausibel,
da Lighthouses Bewertungskurven für Mobile andere (nachsichtigere) Referenzwerte verwenden und ein Teil der
Desktop-Werte stärker durch die tatsächliche Netzwerklatenz zum Server beeinflusst wird als durch die
Seite selbst.
