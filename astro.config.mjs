// @ts-check
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  integrations: [pagefind()],

  server: {
    host: '127.0.0.1',
    port: 4323,
  },

  vite: {
    server: {
      strictPort: true,
    },
  },

  adapter: cloudflare(),
});