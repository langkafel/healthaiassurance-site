# Design-System

Stil: **dunkel-maritim, klinisch-nüchtern**. Flach: keine Schatten, keine Farbverläufe, kein Blur/Glassmorphism.
Alle Werte leben als CSS-Custom-Properties in `src/styles/global.css` (`:root`). Fokus-Zustände sind Pflicht
(`--focus-ring`, 3 px Akzent).

## 1. Tokens

### Farben

| Token | Wert | Verwendung |
| --- | --- | --- |
| `--color-bg` | `#0d1b2a` | Seitenhintergrund |
| `--color-card` | `#1b4965` | Karten, hervorgehobene Flächen |
| `--color-card-alt` | `#162435` | Alternative/tiefere Flächen (Sektionen, Footer, Chips) |
| `--color-border` | `#243d55` | Rahmen, Trennlinien |
| `--color-accent` | `#5bc0eb` | Primärakzent (Cyan): Links, Buttons, Icons |
| `--color-accent-ink` | `#04202c` | Text **auf** Akzent-/Farbflächen (Buttons, Status-Pills) |
| `--color-violet` | `#a78bfa` | Zusatzfarbe |
| `--color-pink` | `#f472b6` | Zusatzfarbe |
| `--color-green` | `#10b981` | Erfolg/„freigegeben“ |
| `--color-amber` | `#f59e0b` | Warnung/„offen“; Referenzkunden-Sticker |
| `--color-red` | `#ef4444` | Fehler/„falsch“ |
| `--color-red-muted` | `#dc2626` | gedämpftes Rot (Flächen mit weißer Schrift) |
| `--color-text` | `#f8f9fa` | Haupttext |
| `--color-text-muted` | `#9fb9cb` | Sekundärtext |
| `--color-text-footer` | `#8da3b5` | Footer-Text |

**Kontrast (WCAG AA, 4,5:1 für normalen Text) ist gemessen, nicht geschätzt** — mit axe-core in echten
Browsern. Relevante Werte:

- `--color-text-muted` auf `--color-card`: **4,70:1**. Der ursprüngliche Wert `#9bb5c8` lag bei 4,49:1 und
  fiel knapp durch; er wurde angehoben (an **fünf** Stellen nachzuziehen, siehe [ADR 2](decisions.md)).
- `--color-accent` auf `--color-card`: 4,66:1, auf `--color-bg`: 8,44:1.
- **Fallstrick:** Halbtransparente Farbtöne mit gleichfarbiger Schrift (z. B. grüner Text auf 16 %-grünem
  Tint über `--color-card`) fallen regelmäßig unter 4,5:1. Status-Elemente deshalb als **deckende Fläche +
  `--color-accent-ink`-Schrift** bauen (rot: `--color-red-muted` + weiße Schrift).
- Amber-Sticker (`/loesung`): `--color-bg` auf `--color-amber` = 8,10:1.

### Radien, Layout

| Token | Wert | Verwendung |
| --- | --- | --- |
| `--radius-card` | 12 px | Karten |
| `--radius-control` | 8 px | Buttons, kleine Elemente |
| `--radius-badge` | 4 px | Badges |
| `--radius-full` | 9999 px | Pills, Kreise |
| `--content-max` | 1180 px | max. Inhaltsbreite (`.container`) |
| `--gutter` | 20 px | seitlicher Abstand |

### Schriften

| Rolle | Token | Familie | Schnitte |
| --- | --- | --- | --- |
| Überschriften, Labels, Buttons, Badges | `--font-heading` | Montserrat | 500, 600, 700, 900 |
| Fließtext | `--font-body` | Inter | 400, 500, 600 |

`h1` ist Montserrat **900** auf jeder Seite (bestimmt die Font-Lade-Strategie, siehe [ADR 5](decisions.md)).
Es ist jeweils nur die Latin-Teilmenge eingebunden (`U+0000–00FF` — deckt Umlaute und ß ab).

Icons: **Phosphor** über `astro-icon` (`<Icon name="ph:..." />`), zur Build-Zeit als Inline-SVG. **Ist-Stand:
überwiegend das Standardgewicht („regular“); die neuen Abschnitte „Zielgruppen“ und „Nutzen“ auf `/loesung` nutzen bereits „light“.** Die ursprüngliche Vorgabe lautete „light“ (`fill` für aktive
Zustände); das wurde nicht umgesetzt und ist als offener Punkt geführt. Verfügbare Varianten im Set:
`ph:<name>-light`, `-fill`, `-bold`, `-thin`, `-duotone`.

## 2. Font-Hosting: warum selbst gehostet statt Google Fonts

Alle Schriften werden von **diesem Server** ausgeliefert (`public/fonts/*.woff2`, deklariert in
`src/styles/fonts.css`). Es gibt **keine** Requests an `fonts.googleapis.com` oder `fonts.gstatic.com`.

**Grund: DSGVO.** Wer Google Fonts dynamisch von Google-Servern einbindet, überträgt beim Seitenaufruf die
IP-Adresse des Besuchers an Google (USA). Das gilt datenschutzrechtlich als problematisch. Ohne Einwilligung
(und diese Seite hat bewusst kein Consent-Banner, siehe [ADR 6](decisions.md)) ist Selbsthosting die saubere
Lösung. *(Allgemeine, nicht geprüfte Aussage ohne belegte Rechtsprechung — Entwicklerkontext, keine
Rechtsberatung; bei Bedarf juristisch klären lassen.)*

Das ist kein theoretisches Risiko: Die ursprünglich gelieferte Quick-Check-Datei lud Google Fonts **live** nach.
Das fiel erst auf, als der Netzwerkverkehr im echten Browser mitgeschnitten wurde, und wurde entfernt.
`docs/testing.md` beschreibt die Prüfung (keine Requests an `googleapis.com`/`gstatic.com`).

Die Dateien stammen einmalig aus Google Fonts (Latin-Subset, je Schnitt eine Datei); Inter und Montserrat stehen
unter der SIL Open Font License.

**Ladestrategie** (`BaseLayout.astro` + `fonts.css`): `inter-400`, `montserrat-700` und `montserrat-900` werden
per `<link rel="preload">` vorgeladen. Alle Schnitte nutzen `font-display: swap`, **außer Montserrat 900:
`optional`** ([ADR 5](decisions.md)). Ein neuer, häufig genutzter Schriftschnitt gehört in die Preload-Liste —
das fehlende Preload von 900 war die Ursache eines gemessenen CLS von 0,196.

## 3. Komponenten-Inventar

Alle in `src/components/` (Astro-Komponenten), Stile in `src/styles/components.css` bzw. je Komponente.

| Komponente | Zweck / Schnittstelle |
| --- | --- |
| `BaseLayout.astro` (Layout) | Setzt `<head>`: Title (`<title> · Health AI Assurance`), Description, Canonical, Open-Graph-/Twitter-Tags inkl. Bild, Favicons, Font-Preloads, JSON-LD (`Organization` immer + `structuredData`-Prop), optional `noindex`. Props: `title`, `description`, `structuredData?`, `noindex?`, `ogImage?` (Standard `/og/og-default.png`, 1200×630), `ogImageAlt?`. Rendert Skip-Link, `Nav`, `<main id="main-content">`, `Footer`. |
| `Nav.astro` | Header, sticky. Links: Lösung, Incident Atlas, Solutions Atlas, Quick Check, Buch; rechts „Kontakt“ (→ `/kontakt`) und „Login für Bestandskunden“ (→ `/login`, intern). Prop `currentPath` steuert `aria-current`. Unter 860 px: Drawer mit Toggle-Skript. |
| `Footer.astro` | Name, Impressum, Datenschutz, Kontakt, Copyright (Jahr wird zur Build-Zeit gesetzt). |
| `Card.astro` | Fläche mit Rahmen. Props: `alt?` (`--color-card-alt`), `class?`. Slot. |
| `Badge.astro` | Kleines Etikett (Rahmen, gedämpfter Text). Gruppierung mit `.badge-row`. Nur neutral — farbcodierte Status-Pills sind seitenlokal. |
| `Callout.astro` | Hinweiskasten mit Icon (`icon`-Prop, Standard `ph:info`), linker Akzentrand. |
| `CtaButtons.astro` | Button-Paar: `primary` (Pflicht) und `secondary?`, je `{label, href, external?}`. Externe Links bekommen `target="_blank" rel="noopener noreferrer"`. |
| `ContactCta.astro` | Kontakt-CTA-Block („Fragen zu Health AI Assurance?“) — auf Startseite und `/loesung` identisch. Enthält den Platzhalter `LINKEDIN_URL` (offen). |
| `EmbedFrame.astro` | iframe-Wrapper für die Atlanten inkl. Höhen-Listener ([ADR 3](decisions.md)). Props: `src`, `title`. |
| `QuickCheckEmbed.astro` | Der komplette Quick Check (Markup, Styles, Fragen, Logik) — siehe [content.md](content.md). |
| `src/lib/schema.ts` | `personSchema()`: Person-JSON-LD für Peter Langkafel (Startseite, `/loesung`). |

Utility-Klassen (`components.css`): `.btn` mit `.btn-primary`/`.btn-secondary`, `.btn-group`, `.btn-soon`
(nicht klickbares „Coming soon“), `.badge`/`.badge-row`, `.card`/`.card-alt`/`.card-grid`, `.callout`,
`.process`/`.process-step`, `.table-wrap`/`.data-table`. Wiederkehrende Muster ohne eigene Komponente, die pro
Seite nachgebaut wurden: Pull-Quote (kursiv, linker Rand — `/buch`, `/loesung`, Autor-Trust), Status-Pills
(Startseite), Modul-Karten (`/loesung`).

### „Atlas-Card“ und „Filter-Chips“ sind keine Komponenten dieser Seite

Karten, Chips, Tabs und Filterleisten der Atlanten existieren **nur innerhalb der iframe-Dokumente**
(`public/embeds/*.html`), mit eigenem CSS in `scripts/embeds/*.dark.css`. Sie sind auf die Design-Tokens
umgefärbt, teilen aber weder Klassen noch Code mit `components.css`. Wer sie auf der Hauptseite wiederverwenden
will, muss sie neu als Astro-Komponenten bauen. Wichtig für Änderungen: **CSS-Variablen reichen nicht über die
iframe-Grenze** — Tokenwerte sind in den `*.dark.css` als Literale kopiert ([ADR 2](decisions.md)).
