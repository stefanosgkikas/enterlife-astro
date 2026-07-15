import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Astro build is wired to generate a Pagefind index', async () => {
  const [config, packageJson] = await Promise.all([
    read('../astro.config.mjs'),
    read('../package.json'),
  ]);

  assert.match(config, /import pagefind from ['"]astro-pagefind['"]/);
  assert.match(config, /integrations:\s*\[\s*pagefind\(\)\s*\]/);
  assert.match(packageJson, /"astro-pagefind":/);
});
