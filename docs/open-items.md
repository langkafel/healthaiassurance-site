# Offene Punkte

Stand: 23. September 2026. Status: **offen** / **erledigt**. Beim Erledigen bitte Datum und Commit ergänzen.

## Vor dem Go-live

| Status | Punkt | Details |
| --- | --- | --- |
| offen | **medhochzwei-URL** | `src/pages/buch.astro`: `MEDHOCHZWEI_URL = 'TODO_MEDHOCHZWEI_URL'` ist der Ziel-Link des Buttons „Beim Verlag ansehen“. Solange der Platzhalter steht, ist das ein **kaputter Link** (relativer Pfad), kein sauberer Coming-soon-Zustand. Echte Produktseiten-URL des Verlags eintragen. |
| offen | **LinkedIn-URL** | `src/components/ContactCta.astro`: `LINKEDIN_URL = '…/TODO-linkedin-profil'`. Betrifft Startseite und `/loesung`. Der Platzhalter ist ein **funktionsloser Link**, nicht nur ein fehlender Text. |
| offen | **`sameAs` im Person-Schema** | `src/lib/schema.ts` lässt `sameAs` bewusst weg, bis eine echte Profil-URL existiert (gleicher Punkt wie LinkedIn). Nach Klärung dort ergänzen. |
| offen | **Buchcover-Auflösung** | Das Cover (`public/img/buch-cover.webp`, Quelle `source-files/buch cover.webp`) ist als 200×281 eingebunden; die Quelldatei ist klein und wirkt auf hochauflösenden Displays unscharf. Bessere Vorlage vom Verlag anfordern und mit `width`/`height` (Seitenverhältnis!) neu einbinden — ein früherer Fehler war ein gestrecktes Cover durch falsche Attribute. |
| offen | **Juristische Prüfung `/datenschutz`** | Text ist redaktionell erstellt und **nicht** anwaltlich geprüft. Prüfen lassen, insbesondere: Server-Logfiles/Hosting (Hetzner), keine Cookies/Tracking (ADR 6), mailto-Kontakt, ob die Aussagen zu externen Links passen. Gilt auch für `/impressum`. |
| offen | **Live-Prüfung des 404-Statuscodes** | `404.astro` existiert (`noindex`, nicht in der Sitemap). Auf der Live-Domain prüfen, dass unbekannte URLs wirklich **HTTP 404** liefern und nicht 200 mit Fehlerseiten-Inhalt (`curl -I https://…/gibt-es-nicht`). Das hängt an der Coolify-/Static-Server-Konfiguration, nicht am Code. |
| offen | **Domain-Umzug** | Aktuell läuft nur die `sslip.io`-Preview. Root und `www.` in Coolify dem Static-Site-Service zuweisen, Zertifikate, `www`-Weiterleitung festlegen. Danach `site` in `astro.config.mjs` und die Sitemap-Zeile in `public/robots.txt` prüfen. Bis dahin sind Canonical/OG/JSON-LD-URLs Annahmen. Siehe [architecture.md](architecture.md). |
| offen | **`app.healthaiassurance.de`-vHost in Coolify** | Der Name löst auf die Server-IP auf, liefert aber 404 bzw. ein nicht vertrauenswürdiges Zertifikat, weil der App-Service dort keine Domain zugewiesen hat. Betrifft die App, nicht dieses Repo — der Login-Link der Seite führt bis dahin ins Leere. |
| offen | **Auto-Deploy-Webhook ungeklärt** | Am 23.09.2026 löste ein Push mehrfach keinen Deploy aus. Ursache nicht diagnostiziert (Prüfreihenfolge in [architecture.md](architecture.md)). |

## Bekannte Mängel (nicht blockierend)

| Status | Punkt | Details |
| --- | --- | --- |
| offen | **Icon-Gewicht** | Vorgabe war Phosphor *light* (aktive Zustände *fill*); umgesetzt ist durchgehend *regular*. Umstellung = Icon-Namen auf `ph:<name>-light` ändern. |
| offen | **Favicon/Logo ist Platzhalter** | „HAA“ in handgezeichneten SVG-Pfaden (`generate-brand-assets.mjs`). Echtes Logo → Skript anpassen, Assets neu erzeugen. |
| offen | **`/embeds/*.html` direkt erreichbar/indexierbar** | Ohne Layout, Nav und Kontext. Maßnahme: `Disallow: /embeds/` in `robots.txt` und/oder `noindex`-Meta beim Bau (`build-embeds.mjs`). `robots.txt` allein verhindert Indexierung nicht zuverlässig. |
| offen | **Inkonsistentes Branding innerhalb der Embeds** | Interne Titel/Köpfe („AI Medical Devices Atlas“, „Standalone-Prototyp“, Incident-Header mit „HAA / HEALTH AI ASSURANCE“) sind Originaltexte. Redaktionell entscheiden, ob angepasst wird (→ `build-embeds.mjs`-Patches). |
| offen | **`/loesung`: „Stand“ ist das Build-Datum** | `new Date()` zur Build-Zeit, nicht das Datum der letzten inhaltlichen Änderung. Bei jedem Rebuild ändert sich das Datum. Fest eintragen oder aus dem Commit ableiten. |
| offen | **Footer: `aria-label="Rechtliches"` enthält „Kontakt“** | Kontakt ist nicht rechtlich; Label auf „Fußzeile“ o. Ä. ändern oder Kontakt herausnehmen. |
| offen | **Quick Check kündigt Plattform als „in Kürze verfügbar“ an** | Text im Intro passt nicht mehr, sobald die Plattform live ist; dann aktualisieren. |
| offen | **Zählerstellen „15 Fragen“** | Nicht abgeleitet, an mehreren Stellen ausgeschrieben ([content.md](content.md)). Bei jeder Änderung der Fragenzahl von Hand nachziehen. |
| offen | **Kurze Seiten lassen Leerraum unter dem Footer** | `404` und `kontakt`: der Footer klebt nicht am Viewportende. Layout auf `min-height` mit Flex-Spalte umstellen. |
| offen | **Performance (Lighthouse Desktop 76–97)** | Serverseitig: fehlende `Cache-Control`-Header, kein HTTP/2, Render-Blocking. Coolify-/Proxy-Konfiguration ([architecture.md](architecture.md)). |
| offen | **A11y-Reste innerhalb der Atlanten** | Aus den Originaldateien: `heading-order`, `landmark-unique`, `nested-interactive`. Nicht Teil der Umfärbung; Behebung heißt, in den Quelldateien bzw. per Patch in `build-embeds.mjs` einzugreifen. |

## Erledigt

| Status | Punkt |
| --- | --- |
| erledigt | Kontrast-Token `--color-text-muted` auf WCAG AA angehoben (`#9fb9cb`), in Seite und beiden Atlanten (ADR 2). |
| erledigt | CLS auf `/buch` behoben (Preload + `font-display: optional` für Montserrat 900, ADR 5). |
| erledigt | Höhen-Synchronisation beider Atlanten (ADR 3) und reproduzierbarer Bau über `scripts/build-embeds.mjs`. |
| erledigt | Google-Fonts-Live-Nachladen aus dem Quick Check entfernt (Selbsthosting). |
| erledigt | Quick Check auf 15 Fragen (Master-Version), alte „12 Fragen“-Reste bereinigt. |
| erledigt | OG-Image, Favicon-Set, 404-Seite, Person-Schema (ohne `sameAs`). |
| erledigt | `/kontakt`-Seite; „Kontakt“ in Header und Footer verweist darauf. |
| erledigt | Projektdokumentation (diese Dateien). |
