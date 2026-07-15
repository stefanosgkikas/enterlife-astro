import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('single author header exposes the optional PDF CV safely', async () => {
  const source = await read('../src/pages/authors/[slug].astro');

  assert.match(source, /author\.cv\?\.url/);
  assert.match(source, /class="author-hero__actions"/);
  assert.match(source, /class="author-hero__action" data-author-cv/);
  assert.match(source, /Πλήρες βιογραφικό/);
  assert.match(source, /target="_blank"/);
  assert.match(source, /rel="noopener noreferrer"/);
  assert.match(source, /type=\{author\.cv\.mimeType\}/);
  assert.match(source, /aria-label="PDF"/);
});

test('single author header renders a safe short bio below responsive actions', async () => {
  const source = await read('../src/pages/authors/[slug].astro');

  assert.match(source, /author\.shortBio/);
  assert.match(
    source,
    /<p class="author-hero__short-bio">\{author\.shortBio\}<\/p>/,
  );
  assert.doesNotMatch(source, /set:html=\{author\.shortBio\}/);
  assert.match(
    source,
    /\.author-hero__actions\s*\{[^}]*flex-wrap:\s*nowrap/s,
  );
  assert.match(
    source,
    /@media\s*\(max-width:\s*48rem\)[\s\S]*?\.author-hero__actions\s*\{[^}]*flex-direction:\s*column/s,
  );
});

test('author details and short bio fill the available profile width', async () => {
  const source = await read('../src/pages/authors/[slug].astro');
  const detailsStyles =
    source.match(/\.author-hero__details\s*\{([^}]*)\}/s)?.[1] ?? '';
  const shortBioStyles =
    source.match(/\.author-hero__short-bio\s*\{([^}]*)\}/s)?.[1] ?? '';

  assert.match(source, /<div class="author-hero__details">/);
  assert.match(detailsStyles, /flex:\s*1/);
  assert.match(detailsStyles, /min-width:\s*0/);
  assert.match(detailsStyles, /width:\s*100%/);
  assert.match(shortBioStyles, /width:\s*100%/);
  assert.doesNotMatch(shortBioStyles, /max-width:/);
});

test('author routes pass category shortcuts into the shared header', async () => {
  const [indexSource, singleSource] = await Promise.all([
    read('../src/pages/authors/index.astro'),
    read('../src/pages/authors/[slug].astro'),
  ]);

  assert.match(indexSource, /deriveBlogCategories/);
  assert.match(indexSource, /authors\.flatMap\(\(author\) => author\.articles\)/);
  assert.match(indexSource, /navigationCategories=\{navigationCategories\}/);
  assert.match(singleSource, /deriveBlogCategories/);
  assert.match(singleSource, /authors\.flatMap\(\(entry\) => entry\.articles\)/);
  assert.match(singleSource, /navigationCategories,\s*$/m);
  assert.match(singleSource, /navigationCategories=\{navigationCategories\}/);
});
