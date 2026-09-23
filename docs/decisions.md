# Architecture Decision Records

Jede Entscheidung: **Kontext** (was war das Problem), **Entscheidung**, **Begründung**, **Konsequenz** (was du
wissen musst, wenn du daran etwas änderst). Status aller Einträge: gültig, Stand 23.09.2026.

Wo eine Begründung eine Abwägung der Projektbeteiligten ist und sich nicht aus dem Code ergibt, ist das
angegeben.

---

## ADR 1 — Atlanten per iframe, Quick Check inline

**Kontext.** Drei fertige, in sich geschlossene HTML-Dateien mussten in das Seitenlayout (Nav, Footer, Design)
eingebunden werden: Solutions Atlas, Incident Atlas, Quick Check. Zwei Wege: (a) direkt in die Astro-Seite
einbetten und das CSS kapseln, (b) als eigenständiges Dokument per `<iframe>`.

**Entscheidung.** Die beiden Atlanten laufen im **iframe** (`EmbedFrame.astro`, Dateien in `public/embeds/`).
Der Quick Check ist **inline** eingebettet (`QuickCheckEmbed.astro`).

**Begründung.** Für jede Datei wurde vorab eine Kollisionsanalyse gemacht (nicht angenommen):

- **Atlanten — Kollisionen deutlich.** Die Dateien enthalten *nackte Element-Selektoren* (`body{}`, `a{}`,
  `h2{}`, `h3{}`, `small{}`, `button:focus-visible{}` und vor allem `header{}` mit Rahmen und Farbverlauf), die
  in der Hauptseite **die Site-Navigation überschrieben** hätten (`<header class="site-header">`). Dazu die
  Klassen `.btn`/`.badge`/`.callout`/`.chip` — Kernklassen des eigenen Design-Systems mit anderer Bedeutung.
  Der Solutions Atlas hat ~40 CSS-Regeln, 1 614 Datensätze und eine **eigene interne Tab-Navigation mit
  komplexem State**; der Incident Atlas ebenso (Suche, vier Selects, Tabs, Diagramm, Modal). Diese Menge an CSS
  und JS in den Seiten-Scope zu schieben, hätte das Risiko schleichender Layout-Fehler erzeugt und jede
  spätere Aktualisierung der Rohdatei (siehe [content.md](content.md)) gefährdet.
- **Quick Check — Kollisionen gering.** Es waren nur wenige Selektoren betroffen (`body`, `a`, `h1`, `h2`,
  `.btn`, `footer`), die sich sauber unter einem Wrapper `.quickcheck` scopen lassen. Er war zunächst als
  iframe eingebunden; die Umstellung wurde vom Betreiber angestoßen (Fragestellung: „warum iframe?“) mit der
  Auflage, bei Inline das 375-px-Verhalten zu prüfen. Inline bringt hier echte Vorteile: kein
  Höhen-Scroll-Problem, Schrift und Farben kommen aus der Seite, das Skript ist klein und kapselbar (IIFE).
  Außerdem lud die Originaldatei Google Fonts live nach — das musste in jedem Fall raus (siehe
  [design-system.md](design-system.md)).

**Konsequenz.**
- Atlanten sind visuell eigene Dokumente: Tokens und Komponenten gelten dort **nicht** automatisch (→ ADR 2),
  die Höhe muss synchronisiert werden (→ ADR 3), Deep-Links in den Atlas gibt es nicht.
- Sie sind unter `/embeds/*.html` **direkt erreichbar**, aber per `noindex, nofollow` von der Indexierung
  ausgenommen (Duplicate Content zu den Seiten, kein Nav/Footer/Impressum).
- Der Quick Check muss seine Stile selbst scopen (`.quickcheck …`) und die `is:global`-Regel beachten (→ ADR 4).
  Neue globale Selektoren außerhalb von `.quickcheck` dürfen dort **nicht** entstehen; das prüft
  `scripts/css-leak-check.mjs`.

---

## ADR 2 — Beide Atlanten sind auf das Design-System umgefärbt, obwohl sie im iframe liegen

**Kontext.** Ein iframe könnte optisch fremd bleiben; die Originaldateien haben ein anderes Farbschema (der
Solutions Atlas ist ein *helles* Theme mit ~40 Literalfarben, der Incident Atlas ein ähnliches, aber nicht
identisches Dunkel).

**Entscheidung.** Beide Dateien werden vollständig auf die Tokens des Design-Systems umgefärbt: Hintergründe,
Rahmen, Akzent, Statusfarben, Diagrammfarben. Struktur, Daten und Logik bleiben unverändert. Farbverläufe und
Elevations-Schatten wurden entfernt (Design-System ist flach).

**Begründung.** Die Seite positioniert die beiden Atlanten (zusammen mit Quick Check und Lösung) als **ein
gemeinsames Wissensportal**. Ein Bruch im Erscheinungsbild an der iframe-Kante würde die Atlanten wie
Fremdinhalt wirken lassen und das Positionierungsargument schwächen. Der Betreiber hat diese Umfärbung explizit
gewollt.

**Konsequenz.**
- **CSS-Custom-Properties reichen nicht über die iframe-Grenze.** Die Tokenwerte stehen als Literale in
  `scripts/embeds/*.dark.css` und in den JS-Patches von `scripts/build-embeds.mjs` (Diagrammfarben). Eine
  Token-Änderung in `global.css` muss dort **von Hand** nachgezogen werden. Tatsächlich passiert:
  `--color-text-muted` wurde von `#9bb5c8` auf `#9fb9cb` angehoben (WCAG, axe: 4,49:1 → 4,70:1) und musste
  in `global.css` sowie beiden Atlas-Stylesheets nachgezogen werden.
- Beim Umfärben fielen mehrere farbige Tint-Badges durch WCAG (Farbe auf 16 %-Tint der gleichen Farbe); sie
  wurden zu **deckender Fläche + dunkler Schrift**. Diese Regel gilt für alle neuen Status-Elemente.
- Gebaut wird mit `node scripts/build-embeds.mjs`. Es bricht mit Fehlermeldung ab, wenn eine erwartete
  Quellstelle nicht mehr existiert — also wenn die Rohdatei ausgetauscht wurde und die Patches angepasst werden
  müssen.
- Es bleibt Inkonsistenz *innerhalb* der Embeds (interne Titel wie „AI Medical Devices Atlas“,
  „Standalone-Prototyp“, eigener Kopf im Incident Atlas). Das wurde bewusst nicht angefasst (Originaltexte);
  siehe [open-items.md](open-items.md).

---

## ADR 3 — Höhe der iframes per `postMessage` synchronisieren

**Kontext.** Zunächst hatten die iframes eine feste Höhe (später `min(1400px, 100vh − 220px)`). Die Atlanten
sind hoch (Tabellen, Kartenlisten) und ändern ihre Höhe mit Tab, Filter und Fenstergröße. Ergebnis: **doppeltes
Scrollen** — Seite *und* iframe scrollen, auf Mobilgeräten nahezu unbenutzbar (Scroll-Falle).

**Entscheidung.** Der eingebettete Inhalt meldet seine Höhe per `postMessage` an die Elternseite; der Wrapper
setzt die Höhe darauf, das iframe bekommt `scrolling="no"`.

- **Nachricht:** `{ type: 'haa-atlas-height', height: <px> }` (`document.documentElement.scrollHeight`).
- **Sender** (in jede Atlas-Datei injiziert): nach `load`, bei `resize`, über einen `ResizeObserver` auf
  `body`, und am Ende der Funktion, die den sichtbaren Inhalt ändert — `navigate()` im Solutions Atlas
  (Tabwechsel), `filter()` im Incident Atlas (Suche/Selects/Tabs/Reset). Jeweils gestaffelt bei 0/60/300 ms, weil
  Layout nach dem Rendern noch nachsetzt.
- **Empfänger** (`EmbedFrame.astro`): ordnet die Nachricht über `event.source` dem richtigen iframe zu (kein
  Zuordnungsfehler bei mehreren Embeds oder fremden Nachrichten), setzt die Wrapper-Höhe auf gemeldete Höhe
  **+ 20 px** (min. 320). Die CSS-Höhe ist nur Fallback bis zur ersten Meldung, mit `transition: height .2s`.

**Begründung.** Die Alternative — Inline (ADR 1) — scheidet für die Atlanten aus. Feste Höhen sind je nach
Tab/Viewport immer falsch; `scrolling="no"` ist nur sicher, wenn die Höhe zuverlässig gemeldet wird.

**Konsequenz — zwei Stolperfallen, beide sind tatsächlich passiert:**
1. **Das Höhen-Skript muss vor dem ersten `<script>` der Datei stehen.** Der Incident Atlas ruft `filter()`
   synchron beim Laden auf; lag das Skript am Dateiende, warf jede Seite `haaReportHeightSoon is not defined`.
2. **Ein Neuaufbau der Embed-Datei ohne den Injektionsschritt entfernt die Synchronisation stillschweigend**
   (Wrapper bleibt dann auf 640 px hängen). Passiert, als der Solutions Atlas einmal aus der Quelle neu erzeugt
   wurde. Deshalb gibt es `scripts/build-embeds.mjs` als einzigen Weg; `public/embeds/*.html` nie von Hand
   bearbeiten. Prüfung nach jeder Änderung: `docs/testing.md` (postMessage-Höhencheck).
- Der Origin-Wert der Nachricht ist `'*'` und der Empfänger prüft `event.source`, nicht `origin`. Für reine
  Höhenwerte unkritisch; sollte die Nachricht je etwas anderes transportieren, ändern.

---

## ADR 4 — Quick Check: nur `innerHTML`-erzeugte Elemente sind `is:global`

**Kontext.** Astro erweitert jeden Selektor eines `<style>`-Blocks um ein Attribut `data-astro-cid-…` und setzt
dieses Attribut **nur auf Elemente, die im Astro-Template stehen**. Der Quick Check baut große Teile seiner
Oberfläche zur Laufzeit per `innerHTML` (Antwortoptionen, Feedback, Ergebnis-Rückblick, Kategorie-Balken).
Diese Elemente tragen das Attribut nie.

**Der Bug (Original).** Nach dem Import waren die Antwortoptionen im Browser **ungestylt** — Buchstaben, Ränder,
Feedback-Farben fehlten — obwohl die CSS-Regeln im Quelltext vorhanden waren. Kein Fehler in Build oder Konsole;
sichtbar nur im Browser.

**Entscheidung.** Zwei Style-Blöcke in `QuickCheckEmbed.astro`:
- ein **scoped** Block für alle Elemente, die im Template stehen;
- ein **`<style is:global>`**-Block **ausschließlich** für Klassen, die zur Laufzeit per `innerHTML` erzeugt werden
  (`.opt`, `.letter`, `.feedback`, `.rev-item`, `.cat-*` …), jeweils **unter `.quickcheck …`** geprägt.

Eine erste, schnelle Reparatur hatte den ganzen Block global gemacht; das wurde in der Review auf die Trennung
zurückgebaut.

**Begründung.** `is:global` für alles würde den Scope-Schutz aufgeben, der gegen Kollisionen mit `.btn`/`.card`
der Hauptseite schützt (ADR 1). Ein nacktes `*`-Reset (box-sizing) wurde abgelehnt; die Variante
`.quickcheck *` ist auf den Wrapper beschränkt.

**Konsequenz.**
- Neues Element im Template → scoped Block. Neues Element in einem `innerHTML`-String → `is:global`-Block,
  Selektor **immer** mit `.quickcheck` beginnen.
- Nach jeder Änderung `scripts/css-leak-check.mjs` laufen lassen: Es vergleicht die berechneten Stile der
  Startseite und von `/buch` vor und nach einem Besuch von `/quick-check` in derselben Sitzung. Ergebnis
  muss „keine Abweichung“ sein. Zusätzlich verifiziert: Die Startseite lädt das Quick-Check-CSS-Bundle nicht.

---

## ADR 5 — `font-display: optional` für Montserrat 900, statt Metrik-Angleichung

**Kontext.** Der H1 aller Seiten ist Montserrat 900. `/buch` zeigte auf der Live-URL **CLS 0,196** (Ziel
< 0,1). Ursache: der 900er-Schnitt war nicht vorgeladen (Preload nur für Inter 400, Montserrat 700) und nutzte
`font-display: swap` — beim Wechsel von der Fallback-Schrift zu Montserrat brach die Überschrift um und
verschob den Rest. Lokal war das nicht sichtbar (keine Latenz), nur unter echter Netzwerkzeit.

**Entscheidung.** (1) Preload für `montserrat-900`; (2) für genau diesen Schnitt `font-display: optional`. Alle
anderen Schnitte bleiben `swap`. Gemessen: CLS 0 und 0,017.

**Begründung.** Erwogen wurde **Metrik-Angleichung** (`size-adjust`, `ascent-override` an die Fallback-Schrift
anpassen). Sie reduziert den Sprung, beseitigt ihn aber nicht und ist pro Fallback-Schrift/Plattform fragil.
`optional` **eliminiert die Verschiebung konstruktionsbedingt**: Ist die Schrift beim ersten Rendern nicht da,
bleibt die Fallback-Schrift für diese Seitenansicht stehen — es gibt keinen späteren Tausch, also nichts, was
springen kann.

**Konsequenz / Kompromiss.** Bei **kaltem Cache und langsamer Verbindung** kann der H1 in der
Fallback-Schrift (Segoe UI / system-ui) erscheinen statt in Montserrat 900. Der Preload macht das selten, aber
nicht unmöglich. Akzeptiert, weil CLS/Stabilität vor pixelgenauer Markenschrift im Erstaufruf gewichtet wurde
(Abwägung des Betreibers/Entwicklers). Wer die Markenschrift immer will, muss auf `swap` zurück **und** die
Metrik-Angleichung bauen und danach CLS live neu messen. Neue häufig genutzte Schriftschnitte: Preload
ergänzen.

---

## ADR 6 — Kein Tracking, keine Analytics, keine Cookies, keine Formulare (außer `mailto:`)

**Kontext.** Die Seite richtet sich an Entscheider im Gesundheitswesen und positioniert sich mit
Vertrauenswürdigkeit/Datenschutz. Die zugehörige Plattform (`app.`) verarbeitet Kundendaten; diese Seite
soll davon strikt getrennt bleiben (siehe [architecture.md](architecture.md)).

**Entscheidung.** Kein Analytics-Skript, keine Cookies, kein Consent-Banner, kein Formular mit Serveranbindung,
keine externen Ressourcen (Schriften, CDNs, Einbettungen). Kontakt ausschließlich über `mailto:`-Links und die
`/kontakt`-Seite. Der Quick Check speichert und sendet nichts.

**Begründung.** Ohne Tracking und ohne Formularverarbeitung werden **keine personenbezogenen Daten
verarbeitet** — kein Consent-Banner nötig, minimaler Datenschutztext, kein Auftragsverarbeiter, kein
Backend, das man absichern müsste. Das passt zum Produktversprechen und zur Angriffsfläche „null“.
Der Betreiber hat das ausdrücklich vorgegeben (die ursprüngliche Aufgabenstellung verbot Tracking-Skripte,
Login und Datenbank).

**Konsequenz.**
- Es gibt **keine Nutzungsdaten** (kein Besucherzähler, keine Conversion-Messung). Erfolg muss anders gemessen
  werden (Server-Logs, Zugriff über Coolify, Rückmeldungen).
- Wer Analytics, ein Kontaktformular, Einbettungen (YouTube, Maps) oder einen CDN-Font ergänzt, ändert die
  Rechtslage: `/datenschutz` und ggf. Consent-Lösung **mit** ändern. Server-seitig fällt nur der übliche
  Webserver-Log an; der Hosting-Hinweis steht in der Datenschutzerklärung.
- `noopener noreferrer` auf externen Links; keine Referrer-Weitergabe an Dritte über eingebundene Ressourcen.
- Prüfung: `scripts/site-audit.mjs` erfasst alle Requests pro Seite (Rohdaten in `test-results/site-audit-raw.json`); dort dürfen außer dem eigenen Host keine Fremd-Hosts auftauchen.

---

## ADR 7 — Der Name ist „Solutions Atlas“, nicht „Zertifizierte Lösungen“

**Kontext.** Der Atlas zeigt KI-basierte Medizinprodukte (FDA-510(k)-Zulassungen und den internationalen
Rahmen). Ein früherer Arbeitstitel für die Seite war „Zertifizierte Lösungen“.

**Entscheidung.** Die Seite und der Menüpunkt heißen **Solutions Atlas**.

**Begründung.** „Zertifizierte Lösungen“ legt nahe, dass **HAA die aufgeführten Lösungen zertifiziert** oder
prüft. HAA vergibt keine Zertifizierungen; die Produkte sind von der FDA freigegeben, nicht von HAA. Der
Name hätte einen Zertifizierungsanspruch erzeugt, den es nicht gibt — ein Irreführungs- und Haftungsrisiko
(rechtliche Bewertung nicht geprüft; die Vermeidung selbst ist die Vorgabe des Betreibers). „Atlas“ beschreibt, was es ist: eine Übersichtskarte, keine Bewertung.

**Konsequenz.**
- Der Haftungsausschluss auf der Seite (Daten aus öffentlichen Quellen, keine Bewertung/Empfehlung, Stichtag)
  ist Teil dieser Entscheidung und darf nicht wegfallen.
- Auch im Text vermeiden: „geprüft“, „zertifiziert“, „empfohlen“ für gelistete Produkte. Das Feld
  `confidence` (Klassen `indication`/`technical`/`open`) beschreibt die **Zuordnungssicherheit der Daten**, nicht die
  Produktqualität.
- Route (`/solutions-atlas`) und Dateiname folgen dem Namen; „Zertifizierte Lösungen“ darf
  nirgends mehr auftauchen (`grep -rni zertifizierte src/`).
