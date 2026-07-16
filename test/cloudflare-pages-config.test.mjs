import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('frontend is configured as a static Cloudflare Pages project', async () => {
  const [astroConfig, packageJson, wranglerConfig] = await Promise.all([
    read('../astro.config.mjs'),
    read('../package.json'),
    read('../wrangler.jsonc'),
  ]);

  assert.doesNotMatch(astroConfig, /@astrojs\/cloudflare|adapter:/);
  assert.match(astroConfig, /site:\s*['"]https:\/\/enterlife\.gr['"]/);
  assert.match(astroConfig, /output:\s*['"]static['"]/);
  assert.match(packageJson, /"deploy":\s*"npm run build && wrangler pages deploy"/);
  assert.doesNotMatch(packageJson, /"@astrojs\/cloudflare"/);
  assert.match(wranglerConfig, /"name":\s*"enterlife-astro"/);
  assert.match(wranglerConfig, /"pages_build_output_dir":\s*"\.\/dist"/);
  assert.match(wranglerConfig, /"DRUPAL_BASE_URL":\s*"https:\/\/admin\.enterlife\.gr"/);
  assert.match(wranglerConfig, /"PUBLIC_SITE_URL":\s*"https:\/\/enterlife\.gr"/);
  assert.doesNotMatch(wranglerConfig, /"main"|"assets"/);
});
