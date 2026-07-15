import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deriveBlogCategories,
  fetchArticles,
  fetchBlogArticles,
  fetchJsonApiPages,
} from '../src/lib/drupal.mjs';

test('fetchArticles requests published articles at build time', async () => {
  let requestedUrl;
  let requestedOptions;
  const fetchImpl = async (url, options) => {
    requestedUrl = new URL(url);
    requestedOptions = options;
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/vnd.api+json' },
    });
  };

  const articles = await fetchArticles({
    baseUrl: 'https://admin.enterlife.gr',
    fetchImpl,
  });

  assert.deepEqual(articles, []);
  assert.equal(requestedUrl.pathname, '/jsonapi/node/article');
  assert.equal(requestedUrl.searchParams.get('filter[status]'), '1');
  assert.equal(requestedUrl.searchParams.get('sort'), '-created');
  assert.equal(requestedUrl.searchParams.get('page[limit]'), '10');
  assert.equal(requestedOptions.headers.Accept, 'application/vnd.api+json');
});

test('fetchArticles rejects an unsuccessful Drupal response', async () => {
  await assert.rejects(
    fetchArticles({
      baseUrl: 'https://admin.enterlife.gr',
      fetchImpl: async () => new Response('offline', { status: 503 }),
    }),
    /Drupal JSON:API returned 503/,
  );
});

test('fetchArticles rejects an invalid JSON:API document', async () => {
  await assert.rejects(
    fetchArticles({
      baseUrl: 'https://admin.enterlife.gr',
      fetchImpl: async () => Response.json({ unexpected: [] }),
    }),
    /missing a data array/,
  );
});

test('fetchBlogArticles requests relationships needed by blog pages', async () => {
	let requestedUrl;
	let requestedOptions;

  const articles = await fetchBlogArticles({
    baseUrl: 'https://admin.enterlife.gr',
    fetchImpl: async (url, options) => {
      requestedUrl = new URL(url);
      requestedOptions = options;
      return Response.json({ data: [], included: [] });
    },
  });

  assert.deepEqual(articles, []);
  assert.equal(requestedUrl.pathname, '/jsonapi/node/article');
  assert.equal(requestedUrl.searchParams.get('filter[status]'), '1');
  assert.equal(requestedUrl.searchParams.get('sort'), '-created');
  assert.equal(requestedUrl.searchParams.get('page[limit]'), '50');
  assert.equal(
    requestedUrl.searchParams.get('include'),
    'uid,uid.user_picture,uid.field_viografiko,field_image,field_tags,field_katigoria_arthroy',
  );
	assert.equal(requestedOptions.headers.Accept, 'application/vnd.api+json');
});

test('fetchBlogArticles follows JSON:API next links and merges included resources', async () => {
	const requests = [];
	const pages = new Map([
		[
			'https://admin.enterlife.gr/jsonapi/node/article?filter%5Bstatus%5D=1&sort=-created&page%5Blimit%5D=50&include=uid%2Cuid.user_picture%2Cuid.field_viografiko%2Cfield_image%2Cfield_tags%2Cfield_katigoria_arthroy&fields%5Buser--user%5D=display_name%2Cfield_onomateponymo%2Cfield_epaggelma%2Cfield_email_epikoinonias_dimosio%2Cfield_viografiko%2Cfield_perigrafi_syntomo_viografi%2Cuser_picture%2Cpath',
			{
				data: [
					{
						id: 'article-1',
						type: 'node--article',
						attributes: {
							title: 'First',
							created: '2026-01-01T00:00:00+00:00',
							path: { alias: '/articles/first' },
						},
					},
				],
				included: [],
				links: {
					next: {
						href: 'https://admin.enterlife.gr/jsonapi/node/article?page[offset]=50',
					},
				},
			},
		],
		[
			'https://admin.enterlife.gr/jsonapi/node/article?page[offset]=50',
			{
				data: [
					{
						id: 'article-2',
						type: 'node--article',
						attributes: {
							title: 'Second',
							created: '2026-01-02T00:00:00+00:00',
							path: { alias: '/articles/second' },
						},
						relationships: {
							field_katigoria_arthroy: {
								data: { type: 'taxonomy_term--category', id: 'cat-1' },
							},
						},
					},
				],
				included: [
					{
						type: 'taxonomy_term--category',
						id: 'cat-1',
						attributes: { name: 'Technology' },
					},
				],
				links: { next: null },
			},
		],
	]);

	const articles = await fetchBlogArticles({
		baseUrl: 'https://admin.enterlife.gr',
		fetchImpl: async (url) => {
			requests.push(String(url));
			return Response.json(pages.get(String(url)));
		},
	});

	assert.deepEqual(articles.map((article) => article.slug), ['first', 'second']);
	assert.equal(articles[1].category, 'Technology');
	assert.equal(requests.length, 2);
});

test('deriveBlogCategories ignores incomplete category data', () => {
	assert.deepEqual(
		deriveBlogCategories([
      { category: 'AI', categorySlug: 'ai' },
      { category: '', categorySlug: 'empty-name' },
      { category: 'Missing slug', categorySlug: null },
      { category: 'AI', categorySlug: 'ai' },
    ]),
    [{ name: 'AI', slug: 'ai', count: 2 }],
  );
});

test('fetchJsonApiPages follows JSON:API next links', async () => {
  const requests = [];
  const pages = new Map([
    ['https://admin.enterlife.gr/jsonapi/node/article?page%5Blimit%5D=2', {
      data: [{ id: '1' }, { id: '2' }],
      links: { next: { href: 'https://admin.enterlife.gr/jsonapi/node/article?page[offset]=2' } },
    }],
    ['https://admin.enterlife.gr/jsonapi/node/article?page[offset]=2', {
      data: [{ id: '3' }],
      links: { next: null },
    }],
  ]);

  const data = await fetchJsonApiPages({
    initialUrl: 'https://admin.enterlife.gr/jsonapi/node/article?page%5Blimit%5D=2',
    fetchImpl: async (url) => {
      requests.push(String(url));
      return Response.json(pages.get(String(url)));
    },
  });

  assert.deepEqual(data.map((item) => item.id), ['1', '2', '3']);
  assert.equal(requests.length, 2);
});

test('fetchJsonApiPages rejects cycles and cross-origin pagination', async () => {
  const start = 'https://admin.enterlife.gr/jsonapi/node/article';
  await assert.rejects(
    fetchJsonApiPages({
      initialUrl: start,
      fetchImpl: async () => Response.json({
        data: [],
        links: { next: { href: start } },
      }),
    }),
    /cycle/i,
  );

  await assert.rejects(
    fetchJsonApiPages({
      initialUrl: start,
      fetchImpl: async () => Response.json({
        data: [],
        links: { next: { href: 'https://attacker.example/steal' } },
      }),
    }),
    /origin/i,
  );
});
