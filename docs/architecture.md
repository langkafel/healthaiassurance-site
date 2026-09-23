# Architektur

Stand: 23. September 2026. Angaben, die nicht aus dem Repo selbst hervorgehen (Hetzner, DNS-Setup,
Coolify-Konfiguration), stammen aus der Beschreibung des Betreibers und sind als solche gekennzeichnet — sie
lassen sich von hier aus nicht verifizieren.

## 1. Zwei Systeme, zwei Domains

| | `healthaiassurance.de` | `app.healthaiassurance.de` |
| --- | --- | --- |
| Was | Marketing- und Wissensseite (**dieses Repo**) | Die HAA-Plattform mit Kundenzugang |
| Technik | Astro, rein statisch | Next.js + Supabase |
| Repo | `healthaiassurance-site` | separates Repo |
| Daten | keine (kein Formular, keine Datenbank, kein Tracking) | Kundendaten |
| Login | nein — nur ein Link zur App | ja |

Die Seite verlinkt an zwei Stellen auf die App (Header „Login für Bestandskunden“ auf jeder Seite, zusätzlich
im Kopfbereich von `/loesung`). Sonst gibt es keine technische Verbindung.

### Warum getrennt? (Risiko-Entkopplung)

Der Kern ist **Blast-Radius-Begrenzung**: Marketing-Änderungen — Texte, neue Seiten, Design, ein
Quick-Check-Update — passieren häufig und von Hand. Wären Seite und Plattform ein Deployment, würde jede dieser
Änderungen einen Redeploy der Plattform mit Kundendaten auslösen. Die Trennung stellt sicher, dass das **nie**
passiert: Ein Fehler in einem Marketing-Commit kann die Plattform nicht erreichen.

Weitere Effekte derselben Trennung:

- Die statische Seite hat **keine** Angriffsfläche im Sinne von Server-Code, Datenbankzugriff oder Secrets — es
  gibt nicht einmal eine `.env`.
- Änderungen an der Plattform (mit Kundendaten) und an der Seite laufen in getrennten Historien und
  Deployments, statt in einem gemeinsamen Commit-Strom.

Die Kehrseite: zwei Repos, zwei Deployments, kein gemeinsamer Code. Was beide Seiten optisch verbindet (Farben,
Fonts), wird bewusst **nicht** technisch geteilt, sondern ist Konvention (siehe
[design-system.md](design-system.md)).

## 2. Tech-Stack

- **Astro 7**, `output: 'static'` (`astro.config.mjs`). Es gibt keine Server-Funktionen; `astro build`
  erzeugt reine HTML/CSS/JS-Dateien nach `dist/`.
- **Integrationen:** `astro-icon` + `@iconify-json/ph` (Phosphor-Icons, zur Build-Zeit als Inline-SVG — keine
  Laufzeit-Requests), `@astrojs/sitemap` (erzeugt `sitemap-index.xml`; schließt `404` automatisch aus).
- **Kein UI-Framework** (kein React/Vue). Interaktivität: ein kleines Skript für das mobile Menü
  (`Nav.astro`), der Quick Check (Vanilla-JS in `QuickCheckEmbed.astro`) und die iframe-Höhenlogik
  (`EmbedFrame.astro`).
- **Dev-Abhängigkeiten** nur für Prüfungen: Playwright, `@axe-core/playwright`, Lighthouse.
- Node ≥ 22.12.

### Warum Astro statt einzelner HTML-Dateien?

Gestartet wurde mit dem Gedanken „ein paar statische HTML-Seiten“. Astro wurde gewählt, weil die Seitenzahl
wächst (heute 10 Seiten inkl. 404) und sich **Nav, Footer, `<head>`-Metadaten, Schema.org-Markup und Komponenten wie
Card/Badge/CTA** sonst in jeder Datei wiederholen und auseinanderlaufen würden. Astro liefert dabei das, was
man braucht, ohne etwas zur Laufzeit mitzuschleppen: Layouts/Komponenten, ein Build-Schritt für Sitemap und
Icons, und **pro Seite ein eigenes CSS-Bundle** (relevant für die CSS-Isolationsprüfung des Quick Checks, siehe
[ADR 4](decisions.md)). Ein SSR-Framework wurde bewusst nicht gewählt: Es gibt nichts Dynamisches
auszuliefern.

## 3. Deployment

```
Entwickler-Push  ──►  GitHub (main)  ──Webhook──►  Coolify  ──►  Hetzner-Server
                                                    │
                                                    └─ Nixpacks, "Static Site",
                                                       Publish Directory /dist
```

- **Quelle:** `github.com/langkafel/healthaiassurance-site`, Branch `main`.
- **Coolify-Service** (laut Betreiber): Nixpacks, Typ *Static Site*, Publish Directory `/dist`; **keine
  Umgebungsvariablen, keine Secrets** nötig.
- **Auto-Deploy:** Ein Push auf `main` soll über einen GitHub-Webhook einen Build in Coolify auslösen.
- **Aktuelle URL:** eine `*.sslip.io`-Preview
  (`http://toc0ux4krplbw3x8jaz9yb39.178.104.15.59.sslip.io/`); die echte Domain ist noch nicht umgezogen
  (→ [open-items.md](open-items.md)).

### Betriebshinweis: Auto-Deploy war am 23.09.2026 unzuverlässig

An diesem Tag löste ein Push mehrfach **keinen** Deploy aus; er musste in Coolify manuell angestoßen werden.
Die Ursache wurde nicht diagnostiziert. Prüfreihenfolge, wenn es wieder passiert:

1. GitHub → Repo → *Settings → Webhooks* → *Recent Deliveries*: kommt der Webhook an, mit welchem Response?
2. Coolify → App: ist *Automatic Deployment* aktiv? Beobachtet die App wirklich `main`?
3. Coolify-Deployment-Log: schlug der Build/Git-Zugriff fehl (abgelaufener Token/Deploy-Key)?

**Nie davon ausgehen, dass ein Push live ist — prüfen.** Ein schneller, belastbarer Check ohne Dashboard: einen
Marker der neuen Version per `curl` von der Live-URL holen, oder den Dateinamen des ausgelieferten
CSS-Bundles (`/_astro/*.css`, enthält einen Inhalts-Hash) mit dem eines lokalen `npm run build` vergleichen.
Ein Inhalts-Marker allein reicht nicht, wenn ein Commit nur CSS-Struktur ändert.

### Bekannte Server-Themen (Lighthouse, nicht App-Code)

Auf der Live-URL meldet Lighthouse wiederkehrend: fehlende `Cache-Control`-Header (100–150 KiB
Einsparpotenzial pro Seite), kein HTTP/2, Render-Blocking-Requests. Das ist Konfiguration des
Coolify-Reverse-Proxys/Static-Servers. Details und Messwerte: `test-results/pre-launch-audit-v2.md`.

## 4. DNS-Architektur

Zielbild (laut Betreiber): drei **A-Records** — Root (`healthaiassurance.de`), `app.` und `www.` — die alle auf
**dieselbe Server-IP** zeigen. Es gibt keine getrennten Server pro Domain. Welche Anwendung eine Anfrage
beantwortet, entscheidet **Coolify über die Domain-Zuweisung pro Service** (Reverse-Proxy anhand des
Host-Headers), nicht das DNS.

Konsequenzen:

- Eine Domain, der in Coolify **kein** Service zugewiesen ist, landet beim Proxy-Fallback. Genau das ist der
  Stand von `app.healthaiassurance.de` am 23.09.2026: Der Name löst auf dieselbe IP auf
  (`178.104.15.59`, identisch zur sslip.io-Preview), aber ein Aufruf liefert **404 (HTTP)** bzw. bei HTTPS ein
  **nicht vertrauenswürdiges Zertifikat** — der Service für die App ist dort noch nicht eingerichtet.
- Ein Domain-Umzug dieser Seite bedeutet: Root- und `www.`-Domain in Coolify dem Static-Site-Service zuweisen
  (Zertifikate über Coolify), Weiterleitung `www` → Root oder umgekehrt festlegen — und danach die Konstante
  `SITE_URL` in `astro.config.mjs` sowie die Sitemap-Zeile in `public/robots.txt` auf die endgültige Form
  prüfen.
- Solange Root/`www` nicht zugewiesen sind, sind die in HTML und Schema.org erzeugten absoluten URLs
  (`canonical`, `og:image`, JSON-LD) **Annahmen** — sie zeigen auf `https://healthaiassurance.de`, das noch
  nicht diese Seite ausliefert.

## 5. Was der Build erzeugt (und warum es wichtig ist)

- `dist/<route>/index.html` je Seite, `dist/404.html`, `dist/sitemap-*.xml`.
- **`dist/embeds/*.html`** sind unverändert kopierte Dateien aus `public/`. Sie sind eigenständige Dokumente mit
  eigenem `<head>` und werden per `<iframe>` eingebunden (→ [ADR 1](decisions.md)). Sie sind auch **direkt
  unter ihrer URL erreichbar** (`/embeds/incident-atlas.html`) — siehe [open-items.md](open-items.md).
- Astro erzeugt **ein CSS-Bundle je Seite** plus ein gemeinsames für das Layout
  (`BaseLayout.*.css`). Seiten laden nur ihr eigenes Bundle: Die Startseite lädt z. B. nie das Quick-Check-CSS.
