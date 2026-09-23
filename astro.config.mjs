// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

// TODO: replace with the final production domain once confirmed (currently
// deployed as a *.sslip.io Coolify preview). Used for canonical URLs,
// schema.org markup and sitemap.xml generation.
const SITE_URL = 'https://healthaiassurance.de';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  integrations: [icon(), sitemap()],
});
