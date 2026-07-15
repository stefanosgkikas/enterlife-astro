import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('blog archive renders normalized articles in a responsive grid', async () => {
  const source = await read('../src/pages/blog/index.astro');
  assert.match(source, /fetchBlogArticles/);
  assert.match(source, /deriveBlogCategories/);
  assert.match(source, /<BlogExplorer/);
  assert.doesNotMatch(source, /fetchBlogCategories/);
});

test('blog explorer provides Pagefind search controls and responsive card grid', async () => {
  const source = await read('../src/components/blog/BlogExplorer.astro');
  assert.match(source, /data-blog-explorer/);
  assert.match(source, /data-category-slugs=\{categories\.map\(\(category\) => category\.slug\)\.join\('\|'\)\}/);
  assert.match(source, /const ARTICLES_PER_PAGE = 12/);
  assert.match(source, /data-blog-pagination/);
  assert.match(source, /document\.addEventListener\('enterlife:blog-search'/);
  assert.match(source, /let activeQuery =/);
  assert.doesNotMatch(source, /if \(!\(input instanceof HTMLInputElement\)\) return;/);
  assert.doesNotMatch(source, /const filterButtons =/);
  assert.match(source, /new URL\(['"]\/pagefind\/pagefind\.js['"],\s*window\.location\.origin\)\.href/);
  assert.match(source, /import\(\/\* @vite-ignore \*\/ pagefindModuleUrl\)/);
  assert.doesNotMatch(source, /import\(\/\* @vite-ignore \*\/ ['"]\/pagefind\/pagefind\.js['"]\)/);
  assert.match(source, /data-blog-card/);
  assert.match(source, /new URLSearchParams\(window\.location\.search\)\.get\('q'\)/);
  assert.match(source, /<ArticleCard/);
  assert.match(source, /const matchingCards = cards\.filter/);
  assert.match(source, /card\.dataset\.categories/);
  assert.match(source, /matchingCards\.slice\(\s*\(currentPage - 1\) \* ARTICLES_PER_PAGE,\s*currentPage \* ARTICLES_PER_PAGE,\s*\)/);
  assert.match(source, /currentPage = 1;/);
  assert.match(
    source,
    /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(
    source,
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(source, /grid-template-columns:\s*1fr/);
});

test('article cards expose semantic metadata and real links', async () => {
  const source = await read('../src/components/blog/ArticleCard.astro');
  assert.match(source, /<article/);
  assert.match(source, /data-blog-card/);
  assert.match(source, /data-url=\{article\.url\}/);
  assert.match(source, /data-search=\{searchText\}/);
  assert.match(source, /<time/);
  assert.match(source, /article\.image/);
  assert.match(source, /href=\{article\.url\}/);
  assert.match(source, /article\.author\.name/);
  assert.match(source, /article\.author\.pictureUrl/);
  assert.match(source, /class="article-card__author-avatar"/);
  assert.match(source, /article-card__author-avatar--fallback/);
  assert.doesNotMatch(source, /Από \{article\.author/);
});

test('article cards render every tag instead of only the first tag', async () => {
  const source = await read('../src/components/blog/ArticleCard.astro');
  assert.match(source, /article\.tags\.map\(\(tag\) =>/);
  assert.doesNotMatch(source, /article\.tags\[0\]/);
});

test('article cards render and expose every assigned category', async () => {
  const source = await read('../src/components/blog/ArticleCard.astro');
  assert.match(source, /const articleCategories =/);
  assert.match(source, /articleCategories\.map\(\(category\) =>/);
  assert.match(source, /data-categories=\{articleCategories\.map\(\(category\) => category\.slug\)\.join\('\|'\)\}/);
});

test('article cards use Drupal category colors for category backgrounds', async () => {
  const source = await read('../src/components/blog/ArticleCard.astro');
  assert.match(source, /color\?: string \| null/);
  assert.match(source, /--article-card-category-background:\s*\$\{category\.color\}/);
  assert.match(
    source,
    /background:\s*var\(--article-card-category-background,\s*var\(--ink-deep\)\);/,
  );
  assert.doesNotMatch(
    source,
    /\.article-card__category\s*\{[\s\S]*background:\s*var\(--ink-deep\);/,
  );
});

test('category archive passes category shortcuts into the shared header', async () => {
  const source = await read('../src/pages/blog/category/[slug].astro');
  assert.match(source, /deriveBlogCategories/);
  assert.match(source, /getArticleCategories/);
  assert.match(source, /ARTICLES_PER_PAGE/);
  assert.match(source, /paginateItems\(cat\.articles,\s*1,\s*ARTICLES_PER_PAGE\)/);
  assert.match(source, /navigationCategories:\s*categories/);
  assert.match(source, /navigationCategories=\{navigationCategories\}/);
  assert.match(source, /articleCount/);
  assert.match(source, /<Pagination/);
});

test('category archive exposes static paginated routes after page one', async () => {
  const source = await read('../src/pages/blog/category/[slug]/page/[page].astro');
  assert.match(source, /getArticleCategories/);
  assert.match(source, /pageNumber > 1/);
  assert.match(source, /paginateItems\(cat\.articles,\s*pageNumber,\s*ARTICLES_PER_PAGE\)/);
  assert.match(source, /params:\s*\{\s*slug:\s*cat\.slug,\s*page:\s*String\(pageNumber\)\s*\}/);
  assert.match(source, /<Pagination/);
});

test('single article route uses getStaticPaths and three-column content', async () => {
  const source = await read('../src/pages/blog/[slug].astro');
  assert.match(source, /export async function getStaticPaths/);
  assert.match(source, /deriveBlogCategories/);
  assert.match(source, /params:\s*\{\s*slug:\s*article\.slug\s*\}/);
  assert.match(source, /navigationCategories:\s*categories/);
  assert.match(source, /navigationCategories=\{navigationCategories\}/);
  assert.match(source, /props:\s*\{\s*article,\s*latestArticles/);
  assert.match(source, /<AuthorCard/);
  assert.match(source, /articleCategories\.map\(\(category\) =>/);
  assert.match(source, /data-pagefind-body/);
  assert.match(source, /data-pagefind-meta="title"/);
  assert.match(source, /data-pagefind-filter="category"/);
  assert.match(source, /data-pagefind-filter="author"/);
  assert.match(source, /data-pagefind-filter="tag"/);
  assert.match(source, /data-pagefind-sort="date\[datetime\]"/);
  assert.match(source, /buildArticleContents/);
  assert.match(source, /set:html=\{articleBodyHtml\}/);
  assert.match(source, /<LatestArticles/);
  assert.match(source, /position:\s*sticky/);
});

test('single article route renders table of contents before latest articles', async () => {
  const source = await read('../src/pages/blog/[slug].astro');
  assert.match(source, /items:\s*articleContents\s*\}\s*=\s*buildArticleContents\(article\.bodyHtml\)/);
  assert.match(source, /articleContents\.length > 0/);
  assert.match(source, /<nav class="article-contents"/);
  assert.match(source, /Περιεχόμενα/);
  assert.match(source, /articleContents\.map\(\(heading\) =>/);
  assert.match(source, /href=\{`#\$\{heading\.id\}`\}/);
  assert.match(source, /<LatestArticles articles=\{latestArticles\}/);
  assert.match(source, /\.article-contents\s*\{/);
  assert.match(source, /scroll-margin-top:\s*7rem/);
});

test('single article route uses Drupal category colors for hero category backgrounds', async () => {
  const source = await read('../src/pages/blog/[slug].astro');
  assert.match(source, /articleCategories\.map\(\(category\) =>/);
  assert.match(source, /--article-hero-category-background:\s*\$\{category\.color\}/);
  assert.match(
    source,
    /background:\s*var\(--article-hero-category-background,\s*var\(--ink-deep\)\);/,
  );
  assert.doesNotMatch(
    source,
    /\.article-hero__category\s*\{[\s\S]*background:\s*var\(--ink-deep\);/,
  );
});

test('single article route renders related article cards below the article', async () => {
  const source = await read('../src/pages/blog/[slug].astro');
  assert.match(source, /import ArticleCard from/);
  assert.match(source, /getRelatedArticles/);
  assert.match(source, /relatedArticles:\s*getRelatedArticles\(article,\s*articles,\s*3\)/);
  assert.match(source, /const \{ article,\s*latestArticles,\s*navigationCategories,\s*relatedArticles \}/);
  assert.match(source, /<section class="related-articles container"/);
  assert.match(source, /Σχετικά άρθρα/);
  assert.match(source, /relatedArticles\.map\(\(relatedArticle\) =>/);
  assert.match(source, /<ArticleCard article=\{relatedArticle\}/);
  assert.match(
    source,
    /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/,
  );
});

test('author share links and latest articles are accessible', async () => {
  const [author, latest] = await Promise.all([
    read('../src/components/blog/AuthorCard.astro'),
    read('../src/components/blog/LatestArticles.astro'),
  ]);
  assert.match(author, /Facebook/);
  assert.match(author, /LinkedIn/);
  assert.match(author, /mailto:/);
  assert.match(latest, /Τελευταία άρθρα/);
  assert.match(latest, /article\.image/);
});
