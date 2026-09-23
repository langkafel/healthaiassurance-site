# healthaiassurance-site

Die öffentliche Marketing- und Wissensseite von **Health AI Assurance** (HAA): Produktvorstellung,
Buchseite, zwei Recherche-Atlanten (Incident Atlas, Solutions Atlas), ein Wissenstest (Quick Check),
Impressum/Datenschutz und Kontakt.

Es ist eine **rein statische Seite** (Astro, `output: 'static'`) — kein Server, keine Datenbank, kein Login,
kein Tracking. Ziel-Domain: `healthaiassurance.de`.

## Verhältnis zu `app.healthaiassurance.de`

Die eigentliche Plattform (Next.js/Supabase, mit Kundendaten) ist ein **separates Repo und ein separates
System** unter `app.healthaiassurance.de`. Diese Seite verlinkt nur dorthin („Login für Bestandskunden“),
teilt aber weder Code noch Deployment noch Daten mit ihr. Warum das so getrennt ist:
[docs/architecture.md](docs/architecture.md).

## Lokales Setup

Voraussetzung: Node.js ≥ 22.12.

```sh
npm install
npm run dev        # Dev-Server auf http://localhost:4321
npm run build      # statischer Build nach ./dist
npm run preview    # ./dist lokal ausliefern (Standardport 4321, z. B. --port 4322)
```

Für die Audit-Skripte (Playwright/Lighthouse/axe) einmalig zusätzlich:

```sh
npx playwright install chromium
```

Details zu den Skripten: [docs/testing.md](docs/testing.md).

## Verzeichnisstruktur

```
.
├─ src/
│  ├─ pages/            eine Datei pro Route (index, loesung, buch, kontakt, quick-check,
│  │                    incident-atlas, solutions-atlas, impressum, datenschutz, 404)
│  ├─ layouts/          BaseLayout.astro  (<head>, Meta/OG/JSON-LD, Nav + Footer)
│  ├─ components/       Nav, Footer, Card, Badge, Callout, CtaButtons, ContactCta,
│  │                    EmbedFrame (iframe-Wrapper), QuickCheckEmbed (Quiz inkl. Fragen)
│  ├─ lib/schema.ts     geteilte schema.org-Bausteine (Person)
│  └─ styles/           global.css (Design-Tokens), components.css, fonts.css
├─ public/
│  ├─ embeds/           FERTIGE Atlas-Seiten (Build-Artefakte, siehe unten)
│  ├─ fonts/            selbst gehostete Montserrat/Inter (woff2)
│  ├─ img/, og/         Bilder, Standard-OG-Image
│  └─ favicon.*, apple-touch-icon.png, robots.txt
├─ source-files/        unveränderte Originaldateien (Atlas-Rohdateien, Fotos, alter Quiz-Entwurf)
├─ scripts/             Build- und Audit-Skripte
│  └─ embeds/           die Dark-Theme-CSS der beiden Atlanten
├─ test-results/        Audit-Berichte (.md getrackt; Screenshots/JSON werden ignoriert)
└─ docs/                die Dokumentation (siehe unten)
```

## Bevor du etwas änderst — die fünf Stolperfallen

1. **`public/embeds/*.html` nie von Hand editieren.** Sie werden aus `source-files/` +
   `scripts/embeds/*.dark.css` erzeugt: `node scripts/build-embeds.mjs`. Ein manueller Neubau ohne das Skript
   verliert die iframe-Höhensynchronisation (ist schon einmal passiert). → [ADR 3](docs/decisions.md)
2. **Design-Tokens gelten nicht in den Atlanten.** Die iframe-Inhalte haben eigene, kopierte Farbwerte.
   Eine Token-Änderung in `global.css` muss in beiden `*.dark.css` nachgezogen werden. → [ADR 2](docs/decisions.md)
3. **Die Fragenanzahl des Quick Checks steht an mehreren Stellen im Text.** → [docs/content.md](docs/content.md)
4. **Kein Tracking, keine Cookies, keine Formulare außer `mailto:`** — bewusst. Wer das ändert, muss
   `/datenschutz` mit ändern. → [ADR 6](docs/decisions.md)
5. **Die Domain `https://healthaiassurance.de` in `astro.config.mjs` (und `robots.txt`) ist eine Annahme**
   bis zum Domain-Umzug. → [docs/open-items.md](docs/open-items.md)

## Dokumentation

| Datei | Inhalt |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Domain-/DNS-Architektur, Tech-Stack, Deployment (GitHub → Coolify → Hetzner) |
| [docs/design-system.md](docs/design-system.md) | Tokens, Fonts (und warum selbst gehostet), Komponenten-Inventar |
| [docs/content.md](docs/content.md) | Sitemap, Datenquellen je Seite, Quick-Check- und Atlas-Datenmodelle |
| [docs/decisions.md](docs/decisions.md) | Architecture Decision Records — **der wichtigste Teil** |
| [docs/testing.md](docs/testing.md) | Audit-Skripte, letzte Ergebnisse, wann man was erneut laufen lässt |
| [docs/open-items.md](docs/open-items.md) | Checkliste offener und erledigter Punkte |

`AGENTS.md` / `CLAUDE.md` im Root stammen vom Astro-Starter (Hinweise zum Dev-Server für KI-Assistenten) und
sind kein Teil der Projektdokumentation.
