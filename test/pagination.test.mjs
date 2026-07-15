import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ARTICLES_PER_PAGE,
  getPaginatedPath,
  paginateItems,
} from '../src/lib/pagination.mjs';

test('paginateItems returns twelve items per page by default', () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1);

  assert.equal(ARTICLES_PER_PAGE, 12);
  assert.deepEqual(paginateItems(items, 1).items, items.slice(0, 12));
  assert.deepEqual(paginateItems(items, 2).items, items.slice(12, 24));
  assert.deepEqual(paginateItems(items, 3).items, items.slice(24, 25));
});

test('paginateItems clamps invalid pages and reports totals', () => {
  const items = Array.from({ length: 13 }, (_, index) => index + 1);
  const firstPage = paginateItems(items, 0);
  const lastPage = paginateItems(items, 99);

  assert.equal(firstPage.currentPage, 1);
  assert.equal(lastPage.currentPage, 2);
  assert.equal(lastPage.totalPages, 2);
  assert.equal(lastPage.totalItems, 13);
});

test('getPaginatedPath keeps the canonical first page URL', () => {
  assert.equal(getPaginatedPath('/blog/category/tech/', 1), '/blog/category/tech/');
  assert.equal(getPaginatedPath('/blog/category/tech/', 2), '/blog/category/tech/page/2/');
});
