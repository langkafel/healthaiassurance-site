# Health AI Assurance — Website

Astro static site (`output: 'static'`) for healthaiassurance.de.

## Commands

| Command           | Action                                      |
| :----------------- | :------------------------------------------ |
| `npm install`       | Install dependencies                        |
| `npm run dev`        | Start local dev server at `localhost:4321`  |
| `npm run build`       | Build production site to `./dist/`         |
| `npm run preview`      | Preview the production build locally      |

## Structure

- `src/pages/` — one file per route
- `src/components/` — shared Nav, Footer, Card, Badge, Callout, CtaButtons, ContactCta, EmbedFrame
- `src/styles/` — design tokens (`global.css`), component styles (`components.css`), self-hosted `@font-face` rules (`fonts.css`)
- `public/fonts/` — self-hosted Montserrat/Inter woff2 files (no Google Fonts calls at runtime)
- `public/embeds/` — the Quick Check and Solutions Atlas single-file HTML apps, embedded via `<iframe>` on their respective pages
- `source-files/` — original files handed off for `/quick-check`, `/solutions-atlas` and `/buch`; not used directly by the site, kept for reference

## Known TODOs before go-live

- `astro.config.mjs`: `SITE_URL` is a placeholder (`healthaiassurance.de`) — confirm the final domain
- `src/components/ContactCta.astro`: `LINKEDIN_URL` placeholder
- `src/pages/buch.astro`: `MEDHOCHZWEI_URL` placeholder
- `/datenschutz` text is a draft pending Peter's legal review
- `public/favicon.ico` / `favicon.svg` are still the default Astro icon
