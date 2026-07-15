import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('homepage uses the shared layout and blog explorer', async () => {
  const source = await read('../src/pages/index.astro');
  assert.match(source, /import Layout from ['"]\.\.\/layouts\/Layout\.astro['"]/);
  assert.match(source, /import BlogExplorer from ['"]\.\.\/components\/blog\/BlogExplorer\.astro['"]/);
  assert.match(source, /deriveBlogCategories/);
  assert.match(source, /<Layout/);
  assert.match(source, /fetchBlogArticles\(\)/);
  assert.doesNotMatch(source, /fetchBlogArticles\(\{\s*limit:\s*3\s*\}\)/);
  assert.match(source, /<BlogExplorer/);
});

test('layout composes reusable site chrome', async () => {
  const source = await read('../src/layouts/Layout.astro');
  assert.match(source, /navigationCategories\?:/);
  assert.match(source, /<Header categories=\{navigationCategories\} \/>/);
  assert.match(source, /<main id="main-content">/);
  assert.match(source, /<Footer \/>/);
});

test('header and footer expose accessible controls', async () => {
  const [header, footer] = await Promise.all([
    read('../src/components/Header.astro'),
    read('../src/components/Footer.astro'),
  ]);
  assert.match(header, /aria-controls="primary-navigation"/);
  assert.match(header, /aria-expanded="false"/);
  assert.match(footer, /type="email"/);
  assert.match(footer, /autocomplete="email"/);
  assert.doesNotMatch(header, /href="#journal"/);
  assert.doesNotMatch(footer, /href="#journal"/);
});

test('shared navigation works from nested blog routes', async () => {
  const header = await read('../src/components/Header.astro');
  assert.doesNotMatch(header, /href:\s*['"]\/#articles['"]/);
  assert.doesNotMatch(header, /href:\s*['"]\/#blog-categories['"]/);
  assert.match(header, /href:\s*['"]\/authors\/['"]/);
  assert.match(header, /class="header-search"/);
  assert.match(header, /data-header-search/);
  assert.match(header, /name="q"/);
  assert.match(header, /new CustomEvent\('enterlife:blog-search'/);
  assert.match(header, /window\.location\.assign\(`\/\?q=\$\{encodeURIComponent\(query\)\}#articles`\)/);
  assert.doesNotMatch(header, /#article-search/);
  assert.match(header, /href="http:\/\/admin\.enterlife\.localhost\/user\/login\/"/);
  assert.match(header, /Login/);
  assert.doesNotMatch(header, /#services/);
  assert.doesNotMatch(header, /#wellness/);
});

test('homepage passes real blog categories into the sticky header', async () => {
  const source = await read('../src/pages/index.astro');
  assert.match(source, /navigationCategories=\{categories\}/);
});

test('sticky header exposes category shortcuts without extra cards or utility chrome', async () => {
  const header = await read('../src/components/Header.astro');
  assert.match(header, /position:\s*sticky/);
  assert.match(header, /top:\s*0/);
  assert.match(header, /categories\.slice\(0,\s*6\)/);
  assert.match(header, /href=\{category\.href\}/);
  assert.match(header, /data-header-filter=\{category\.slug\}/);
  assert.match(header, /data-header-filter-name=\{category\.label\}/);
  assert.doesNotMatch(header, /utility-bar/);
});

test('sticky header lets search grow while login stays fixed at the right edge', async () => {
  const header = await read('../src/components/Header.astro');
  assert.match(
    header,
    /grid-template-columns:\s*minmax\(0,\s*max-content\)\s+minmax\(12rem,\s*1fr\)\s+max-content/,
  );
  assert.match(header, /\.category-nav\s*\{[\s\S]*?grid-column:\s*1/);
  assert.match(header, /\.header-search\s*\{[\s\S]*?grid-column:\s*2/);
  assert.match(header, /\.header-search\s*\{[\s\S]*?width:\s*100%/);
  assert.match(header, /\.login-link\s*\{[\s\S]*?grid-column:\s*3/);
  assert.match(header, /\.login-link\s*\{[\s\S]*?justify-self:\s*end/);
  assert.match(header, /\.login-link\s*\{[\s\S]*?width:\s*max-content/);
  assert.match(header, /\.login-link\s*\{[\s\S]*?flex:\s*0 0 auto/);
});

test('global styles respect reduced motion', async () => {
  const source = await read('../src/styles/global.css');
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
  assert.match(source, /:focus-visible/);
});
