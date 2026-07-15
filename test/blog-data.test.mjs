import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createExcerpt,
  buildArticleContents,
  deriveBlogCategories,
  extractArticleSlug,
  fetchAuthors,
  getRelatedArticles,
  htmlToPlainText,
  normalizeBlogDocument,
} from '../src/lib/drupal.mjs';

function createJsonApiFixture({
  duplicate = false,
  cvMimeType = 'application/pdf',
  multipleCategories = false,
} = {}) {
  const article = {
    type: 'node--article',
    id: 'article-1',
    attributes: {
      status: true,
      title: 'Δοκιμαστικό άρθρο',
      created: '2026-07-04T08:00:00+00:00',
      body: {
        processed: '<p>Ένα <strong>χρήσιμο</strong> άρθρο για δοκιμή.</p>',
      },
      path: { alias: '/articles/dokimastiko-arthro' },
    },
    relationships: {
      uid: { data: { type: 'user--user', id: 'user-1' } },
      field_katigoria_arthroy: {
        data: multipleCategories
          ? [
              { type: 'taxonomy_term--blog_category', id: 'category-1' },
              { type: 'taxonomy_term--blog_category', id: 'category-2' },
            ]
          : { type: 'taxonomy_term--blog_category', id: 'category-1' },
      },
      field_image: {
        data: {
          type: 'file--file',
          id: 'article-image',
          meta: {
            alt: 'Εικόνα άρθρου',
            width: 1400,
            height: 850,
          },
        },
      },
      field_tags: {
        data: [{ type: 'taxonomy_term--tags', id: 'tag-1' }],
      },
    },
  };

  return {
    data: duplicate
      ? [
          article,
          {
            ...article,
            id: 'article-2',
            attributes: {
              ...article.attributes,
              title: 'Δεύτερο άρθρο με ίδιο alias',
            },
          },
        ]
      : [article],
    included: [
      {
        type: 'user--user',
        id: 'user-1',
        attributes: {
          display_name: 'stefanos',
          field_perigrafi_syntomo_viografi: {
            value:
              '<p>Πρώτη παράγραφος&nbsp;βιογραφικού.</p><p>Δεύτερη <strong>παράγραφος</strong>.</p>',
            processed:
              '<p>Πρώτη παράγραφος&nbsp;βιογραφικού.</p><p>Δεύτερη <strong>παράγραφος</strong>.</p>',
          },
        },
        relationships: {
          user_picture: {
            data: { type: 'file--file', id: 'author-picture' },
          },
          field_viografiko: {
            data: { type: 'file--file', id: 'author-cv' },
          },
        },
      },
      {
        type: 'file--file',
        id: 'article-image',
        attributes: {
          uri: { url: '/sites/default/files/article.webp' },
        },
      },
      {
        type: 'file--file',
        id: 'author-picture',
        attributes: {
          uri: { url: '/sites/default/files/avatar.jpg' },
        },
      },
      {
        type: 'file--file',
        id: 'author-cv',
        attributes: {
          filename: 'full-cv.pdf',
          filemime: cvMimeType,
          uri: { url: '/sites/default/files/cv/full-cv.pdf' },
        },
      },
      {
        type: 'taxonomy_term--tags',
        id: 'tag-1',
        attributes: { name: 'AI' },
      },
      {
        type: 'taxonomy_term--blog_category',
        id: 'category-1',
        attributes: { name: 'Technology' },
      },
      {
        type: 'taxonomy_term--blog_category',
        id: 'category-2',
        attributes: { name: 'Wellness' },
      },
    ],
  };
}

test('extractArticleSlug returns only valid Article Pathauto slugs', () => {
  assert.equal(
    extractArticleSlug('/articles/ena-dokimastiko-arthro'),
    'ena-dokimastiko-arthro',
  );
  assert.equal(extractArticleSlug('/node/1'), null);
  assert.equal(extractArticleSlug('/articles/'), null);
  assert.equal(extractArticleSlug(''), null);
});

test('getRelatedArticles prioritizes shared tags before shared categories', () => {
  const current = {
    id: 'current',
    tags: ['AI', 'SEO'],
    categories: [{ name: 'Technology', slug: 'technology' }],
  };
  const tagMatch = {
    id: 'tag-match',
    created: '2026-02-01T00:00:00+00:00',
    tags: ['AI'],
    categories: [{ name: 'Beauty', slug: 'beauty' }],
  };
  const strongerTagMatch = {
    id: 'stronger-tag-match',
    created: '2026-01-01T00:00:00+00:00',
    tags: ['AI', 'SEO'],
    categories: [{ name: 'Other', slug: 'other' }],
  };
  const categoryMatch = {
    id: 'category-match',
    created: '2026-03-01T00:00:00+00:00',
    tags: ['Drupal'],
    categories: [{ name: 'Technology', slug: 'technology' }],
  };
  const unrelated = {
    id: 'unrelated',
    created: '2026-04-01T00:00:00+00:00',
    tags: ['Food'],
    categories: [{ name: 'Nutrition', slug: 'nutrition' }],
  };

  assert.deepEqual(
    getRelatedArticles(current, [
      unrelated,
      current,
      categoryMatch,
      tagMatch,
      strongerTagMatch,
    ]).map((article) => article.id),
    ['stronger-tag-match', 'tag-match', 'category-match'],
  );
});

test('getRelatedArticles uses shared categories before latest fallback articles', () => {
  const current = {
    id: 'current',
    tags: ['AI'],
    categories: [{ name: 'Technology', slug: 'technology' }],
  };

  assert.deepEqual(
    getRelatedArticles(current, [
      current,
      {
        id: 'category-match',
        created: '2026-01-01T00:00:00+00:00',
        tags: ['Drupal'],
        categories: [{ name: 'Technology', slug: 'technology' }],
      },
      {
        id: 'unrelated',
        created: '2026-02-01T00:00:00+00:00',
        tags: ['Food'],
        categories: [{ name: 'Nutrition', slug: 'nutrition' }],
      },
    ]).map((article) => article.id),
    ['category-match', 'unrelated'],
  );
});

test('createExcerpt removes markup and truncates at a word boundary', () => {
  assert.equal(
    createExcerpt('<p>Μία <strong>καθαρή</strong> περίληψη.</p>', 80),
    'Μία καθαρή περίληψη.',
  );
  assert.equal(
    createExcerpt('<p>Ένα αρκετά μεγάλο κείμενο για ασφαλή περικοπή.</p>', 24),
    'Ένα αρκετά μεγάλο…',
  );
});

test('htmlToPlainText removes markup and decodes supported entities', () => {
  assert.equal(
    htmlToPlainText(
      '<p>Πρώτη&nbsp;παράγραφος.</p><p>Δεύτερη <strong>&amp;</strong> τρίτη.</p>',
    ),
    'Πρώτη παράγραφος. Δεύτερη & τρίτη.',
  );
  assert.equal(htmlToPlainText(null), '');
});

test('buildArticleContents creates anchor ids for h1 and h2 headings', () => {
  const result = buildArticleContents(
    '<p>Intro</p><h2>Πρώτη <em>ενότητα</em></h2><h3>Δεν μπαίνει</h3><h1 id="custom-heading">Μεγάλη ενότητα</h1><h2>Πρώτη ενότητα</h2>',
  );

  assert.deepEqual(result.items, [
    { id: 'article-πρωτη-ενοτητα', level: 2, text: 'Πρώτη ενότητα' },
    { id: 'custom-heading', level: 1, text: 'Μεγάλη ενότητα' },
    { id: 'article-πρωτη-ενοτητα-2', level: 2, text: 'Πρώτη ενότητα' },
  ]);
  assert.match(result.html, /<h2 id="article-πρωτη-ενοτητα">/);
  assert.match(result.html, /<h1 id="custom-heading">/);
  assert.match(result.html, /<h2 id="article-πρωτη-ενοτητα-2">/);
  assert.doesNotMatch(result.html, /<h3 id=/);
});

test('normalizeBlogDocument resolves article relationships', () => {
  const [article] = normalizeBlogDocument(
    createJsonApiFixture(),
    'https://admin.enterlife.gr',
  );

  assert.equal(article.slug, 'dokimastiko-arthro');
  assert.equal(article.url, '/blog/dokimastiko-arthro');
  assert.equal(article.bodyHtml, '<p>Ένα <strong>χρήσιμο</strong> άρθρο για δοκιμή.</p>');
  assert.equal(
    article.image.url,
    'https://admin.enterlife.gr/sites/default/files/article.webp',
  );
  assert.equal(article.image.alt, 'Εικόνα άρθρου');
  assert.equal(article.image.width, 1400);
  assert.equal(article.image.height, 850);
  assert.equal(article.author.name, 'stefanos');
  assert.equal(
    article.author.pictureUrl,
    'https://admin.enterlife.gr/sites/default/files/avatar.jpg',
  );
  assert.deepEqual(article.author.cv, {
    url: 'https://admin.enterlife.gr/sites/default/files/cv/full-cv.pdf',
    filename: 'full-cv.pdf',
    mimeType: 'application/pdf',
  });
  assert.equal(
    article.author.shortBio,
    'Πρώτη παράγραφος βιογραφικού. Δεύτερη παράγραφος.',
  );
  assert.doesNotMatch(article.author.shortBio, /<[^>]+>/);
  assert.deepEqual(article.tags, ['AI']);
});

test('normalizeBlogDocument preserves all article categories from multi-value taxonomy relationships', () => {
  const [article] = normalizeBlogDocument(
    createJsonApiFixture({ multipleCategories: true }),
    'https://admin.enterlife.gr',
  );

  assert.deepEqual(article.categories, [
    { name: 'Technology', slug: 'technology' },
    { name: 'Wellness', slug: 'wellness' },
  ]);
  assert.equal(article.category, 'Technology');
  assert.equal(article.categorySlug, 'technology');
});

test('normalizeBlogDocument preserves category colors from Drupal taxonomy terms', () => {
  const document = createJsonApiFixture({ multipleCategories: true });
  document.included.find((resource) => resource.id === 'category-1')
    .attributes.field_hroma_katigorias = '#263f48';
  document.included.find((resource) => resource.id === 'category-2')
    .attributes.field_hroma_katigorias = '#7faec0';

  const [article] = normalizeBlogDocument(document, 'https://admin.enterlife.gr');

  assert.deepEqual(article.categories, [
    { name: 'Technology', slug: 'technology', color: '#263f48' },
    { name: 'Wellness', slug: 'wellness', color: '#7faec0' },
  ]);
});

test('fetchAuthors propagates the normalized author PDF', async () => {
  const [author] = await fetchAuthors({
    baseUrl: 'https://admin.enterlife.gr',
    fetchImpl: async () => Response.json(createJsonApiFixture()),
  });

  assert.deepEqual(author.cv, {
    url: 'https://admin.enterlife.gr/sites/default/files/cv/full-cv.pdf',
    filename: 'full-cv.pdf',
    mimeType: 'application/pdf',
  });
  assert.equal(
    author.shortBio,
    'Πρώτη παράγραφος βιογραφικού. Δεύτερη παράγραφος.',
  );
});

test('fetchAuthors preserves article category metadata for shared navigation', async () => {
  const [author] = await fetchAuthors({
    baseUrl: 'https://admin.enterlife.gr',
    fetchImpl: async () => Response.json(createJsonApiFixture()),
  });

  assert.equal(author.articles[0].category, 'Technology');
  assert.equal(author.articles[0].categorySlug, 'technology');
});

test('normalizeBlogDocument omits non-PDF author attachments', () => {
  const [article] = normalizeBlogDocument(
    createJsonApiFixture({ cvMimeType: 'text/plain' }),
    'https://admin.enterlife.gr',
  );

  assert.equal(article.author.cv, null);
});

test('normalizeBlogDocument rejects duplicate slugs', () => {
  assert.throws(
    () =>
      normalizeBlogDocument(
        createJsonApiFixture({ duplicate: true }),
        'https://admin.enterlife.gr',
      ),
    /Duplicate Drupal article slug: dokimastiko-arthro/,
  );
});

test('deriveBlogCategories returns unique article categories with counts', () => {
  const categories = deriveBlogCategories([
    { category: 'Διατροφή', categorySlug: 'diatrofi' },
    { category: 'Ύπνος', categorySlug: 'ypnos' },
    { category: 'Διατροφή', categorySlug: 'diatrofi' },
    {
      categories: [
        { name: 'Διατροφή', slug: 'diatrofi' },
        { name: 'Τεχνολογία', slug: 'technologia' },
      ],
    },
    { category: null, categorySlug: null },
  ]);

  assert.deepEqual(categories, [
    { name: 'Διατροφή', slug: 'diatrofi', count: 3 },
    { name: 'Ύπνος', slug: 'ypnos', count: 1 },
    { name: 'Τεχνολογία', slug: 'technologia', count: 1 },
  ]);
});
