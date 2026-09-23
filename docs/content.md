# Inhalte und Datenquellen

## 1. Sitemap

| Route | Datei | Zweck | Zielgruppe |
| --- | --- | --- | --- |
| `/` | `pages/index.astro` | Einstieg: Was ist HAA, für wen, Wege zu Lösung/Atlanten/Quick Check/Buch; Autor-Vertrauensblock | Alle Erstbesucher (Krankenhaus-Management, Hersteller, Berater) |
| `/loesung` | `pages/loesung.astro` | Produktseite der Plattform: Module, Prozess, Referenzkunden-Sticker; verlinkt auf die App | Entscheider mit konkretem Interesse an der Plattform |
| `/buch` | `pages/buch.astro` | Buchseite (Cover, Eckdaten, Autor, Link zum Verlag) inkl. Schema.org `Book` | Leser/Multiplikatoren, Buchinteressierte |
| `/incident-atlas` | `pages/incident-atlas.astro` | Kuratierte Sammlung dokumentierter KI-Vorfälle im Gesundheitswesen (Recherche-Atlas) | Risiko-/Compliance-Verantwortliche, Fachöffentlichkeit |
| `/solutions-atlas` | `pages/solutions-atlas.astro` | Übersicht KI-basierter Medizinprodukte (FDA-Daten + internationale Regulierung) | Hersteller, Regulatory Affairs, Beschaffung |
| `/quick-check` | `pages/quick-check.astro` | 15-Fragen-Wissenstest zu KI-Governance im Gesundheitswesen (Lead-in zum Buch/zur Lösung) | Breite Fachöffentlichkeit |
| `/kontakt` | `pages/kontakt.astro` | Kontaktseite (mailto), Ziel der „Kontakt“-Links in Header/Footer | Interessenten |
| `/impressum` | `pages/impressum.astro` | Pflichtangaben (§ 5 DDG) | Rechtlich |
| `/datenschutz` | `pages/datenschutz.astro` | Datenschutzerklärung (siehe [open-items.md](open-items.md): juristische Prüfung offen) | Rechtlich |
| `/404` | `pages/404.astro` | Fehlerseite (`noindex`, nicht in der Sitemap) | — |

Die Sitemap (`sitemap-index.xml`) wird von `@astrojs/sitemap` erzeugt; `404` ist ausgeschlossen. Die
Header-Navigation listet Lösung, Incident Atlas, Solutions Atlas, Quick Check, Buch sowie „Kontakt“ und den
App-Login.

## 2. Datenquelle je Seite

| Seite | Wie eingebunden | Quelle der Daten |
| --- | --- | --- |
| Statische Seiten | Text direkt im `.astro`-File | Redaktionell (Betreiber-Texte) |
| `/solutions-atlas` | **iframe** → `public/embeds/solutions-atlas.html` | Peters **Original-Recherchedatei** `source-files/KI_Medizinprodukte_Interaktiver_Atlas.html` (Stichtag der FDA-Daten 29.06.2026, erzeugt 23.09.2026). 1:1 übernommen, nur umgefärbt. |
| `/incident-atlas` | **iframe** → `public/embeds/incident-atlas.html` | **Eigene Datei** `source-files/Health_AI_Incident_Failure_Atlas_ERWEITERT_41_2026-09-23.html` (41 Fälle). Ersetzte eine frühere, kleinere Version. |
| `/quick-check` | **inline** (`QuickCheckEmbed.astro`) | 15 Fragen aus der **faktengeprüften Master-Version**; der ursprüngliche Entwurf (12 Fragen) liegt als `source-files/wissenscheck (2).html` und ist überholt. |

**Wichtig — Datenpflege:** Die Atlanten haben **keinen Build-Schritt für Daten**. Die Daten sind als
JavaScript-Literale (`const DATA=…`) direkt in der jeweiligen HTML-Datei eingebettet. Wer Daten aktualisieren
will, ersetzt die Datei in `source-files/` durch die neue Version der Recherche und führt
`node scripts/build-embeds.mjs` aus (er bricht laut ab, wenn eine der erwarteten Textstellen für die
Umfärbung/Höhen-Hooks in der neuen Datei nicht mehr vorkommt — dann muss das Skript angepasst werden, siehe
[ADR 2/3](decisions.md)). Die Rohdateien in `source-files/` **nicht** hand-editieren.

## 3. Quick Check

### Datenmodell

Alles steht in `src/components/QuickCheckEmbed.astro` in einem `<script is:inline>`-Block (Vanilla-JS, keine
Abhängigkeiten). Zwei Konstanten:

```js
var CATEGORIES = [ "Regulatorik & Verantwortung", "Klinische Validierung & Fairness",
                   "Halluzinationen & Betrieb", "Governance & Sicherheit",
                   "Wirtschaftlichkeit & Umsetzung" ];   // 5 Themenblöcke

var QUESTIONS = [ {
  n: 1,                       // laufende Nummer (Anzeige "Frage n von N")
  category: "Regulatorik & Verantwortung",   // MUSS exakt einem CATEGORIES-String entsprechen
  title: "EU AI Act – die neuen Fristen",     // Kurztitel
  q: "…Fragetext…",
  opts: ["…", "…", "…", "…", "…"],           // genau 5 Antworten (A–E)
  correct: 2,                                 // 0-basierter Index der richtigen Antwort
  expl: "…Erklärung, wird nach der Antwort gezeigt…",
  bookRef: "Kap. …",                          // Verweis ins Buch
  sources: ["…", "…"]                         // Quellen als reiner Text (keine Links)
}, … ];
```

Ablauf: eine Frage pro Ansicht, sofortiges Feedback mit Erklärung; am Ende Gesamtquote und Auswertung je
Kategorie (`stats`), Rückblick über alle Fragen (`.rev-item`). Ergebnis-Schwellen: **≥ 83 %** grün, **≥ 50 %**
gelb, darunter rot. Nichts wird gespeichert oder gesendet.

### Frage ändern

1. Im `QUESTIONS`-Array das Objekt bearbeiten. Antworten immer **fünf**; `correct` ist **0-basiert**.
2. **Gerade Anführungszeichen `"` im Text** beenden den JS-String und brechen den Build. Typografische
   („…“, U+201C/U+201D) verwenden oder `\"` escapen. (Ist beim Import der 15 Fragen dreimal passiert.)
3. Faktenänderungen (Fristen, Zahlen) immer mit `sources` und `bookRef` zusammen aktualisieren.

### Frage hinzufügen/entfernen

1. Objekt ans Array anhängen bzw. löschen; `n` fortlaufend halten.
2. `category` muss existieren, sonst bricht die Kategorie-Auswertung. Eine **neue Kategorie** zusätzlich in
   `CATEGORIES` eintragen; die Auswertung je Kategorie (`.cat-row`, `.cat-name`, …) wird daraus generiert.
   Alle per `innerHTML` erzeugten Elemente werden über den `is:global`-Style gestaltet ([ADR 4](decisions.md)).
3. Die Zahl **„15“ ist an mehreren Stellen ausgeschrieben** und wird nicht aus dem Array abgeleitet:
   Startseiten-Karte, Meta-Description von `/quick-check`, Intro-Text im Quick Check, ggf. Buch/Lösung.
   Nach jeder Änderung suchen: `grep -rn "15 Fragen\|15 Question\|zwölf\|12 Fragen" src/`. Stehen gelassene
   „12 Fragen“-Reste sind schon einmal live gegangen.
4. Das Audit-Skript `scripts/quick-check-15-audit.mjs` prüft die Zahl 15 fest — mitziehen; das
   allgemeinere `site-audit.mjs` spielt den Test dagegen mit dynamischer Fragenzahl durch.

## 4. Solutions Atlas — Datenmodell

`const DATA` im Rohfile hat fünf Listen plus zwei Stichtage (`generated`, `fdaAsOf`):

| Liste | Anzahl | Felder | Bedeutung |
| --- | --- | --- | --- |
| `products` | 1 614 | `date, year, id, name, company, panel, code, app, func, purpose, confidence, confidenceClass, url` | KI-bezogene FDA-510(k)-Zulassungen. `id` = K-Nummer, `panel` = FDA-Fachgebiet, `code` = Produktcode, `app`/`func`/`purpose` = **abgeleitete** Klassifikation, `url` = FDA-Datenbankeintrag. |
| `metrics` | 23 | `region, agency, metric, value, unit, specialty, risk, procedure, period, published, asof, type, denominator, source, url, method, limitations, evidence, verification` | Kennzahlen zu Zulassungen anderer Regionen (Werte mit Nenner, Methode, Einschränkungen). |
| `regulatory` | 15 | `region, agency, class_, guideline, change, reliance` | Regulatorische Rahmen je Region (Behörde, Risikoklasse, Leitlinie, Änderung, Reliance-Pfad). |
| `missing` | 11 | `region, status, reason` | Regionen ohne belastbare Daten und warum. |
| `issues` | 4 | `topic, values, reason, recommendation` | Datenqualitäts-/Interpretationshinweise. |

`confidenceClass` in `products` sagt, wie sicher die Zuordnung zu einer klinischen Anwendung ist:
`indication` (267, Hinweis aus dem Produktnamen), `technical` (1 022, nur technische Klasse aus Produktcode/-name,
**keine** klinische Indikation), `open` (325, FDA-Entscheidungsdokument muss geprüft werden). Diese
Unterscheidung ist inhaltlich zentral; die Oberfläche zeigt sie als Pills — beim Umfärben dürfen die drei
Klassen nicht farblich ununterscheidbar werden.

### Incident Atlas — Datenmodell (zur Vollständigkeit)

Liste von 41 Fällen: `id` („HAI-001“), `n`, `title`, `sector`, `country`, `year`, `mode` (Fehlermodus, z. B.
„Validierung“), `kind` (`real` 21 / `reported` 8 / `experimental` 12), `subkind`, `desc`, `grade` (Evidenzklasse
A–D: Primärdokument / Real-World-Studie / Meldung / experimentell), `evidenceOriginal`, `causality`, `harm`,
`lesson`, `sources[]` (`label`, `url`). `kind` und `grade` steuern Farben und Filter; Filterlogik zentral in
`filter()`.
