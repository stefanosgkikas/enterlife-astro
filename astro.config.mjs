// @ts-check
import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';

// https://astro.build/config
export default defineConfig({
  site: 'https://enterlife.gr',
  output: 'static',

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
});
