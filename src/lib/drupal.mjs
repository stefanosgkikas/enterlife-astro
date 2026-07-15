/**
 * @typedef {{
 *   id: string,
 *   type: 'node--article',
 *   attributes: {
 *     title: string,
 *     created: string,
 *     body?: { processed?: string }
 *   }
 * }} DrupalArticle
 */

/**
 * Fetch every page from a same-origin Drupal JSON:API collection.
 *
 * @param {{
 *   initialUrl: string | URL,
 *   fetchImpl?: typeof fetch,
 *   maxPages?: number
 * }} options
 * @returns {Promise<Array<unknown>>}
 */
export async function fetchJsonApiPages({
  initialUrl,
  fetchImpl = fetch,
  maxPages = 100,
}) {
  const documents = await fetchJsonApiDocuments({
    initialUrl,
    fetchImpl,
    maxPages,
  });

  return documents.flatMap((document) => document.data);
}

async function fetchJsonApiDocuments({
  initialUrl,
  fetchImpl = fetch,
  maxPages = 100,
}) {
  if (!Number.isInteger(maxPages) || maxPages < 1) {
    throw new Error('maxPages must be a positive integer');
  }

  const firstUrl = new URL(initialUrl);
  const allowedOrigin = firstUrl.origin;
  const visited = new Set();
  const documents = [];
  let nextUrl = firstUrl;

  while (nextUrl) {
    if (visited.size >= maxPages) {
      throw new Error(`Drupal JSON:API pagination exceeded ${maxPages} pages`);
    }
    if (nextUrl.origin !== allowedOrigin) {
      throw new Error('Drupal JSON:API pagination changed origin');
    }
    if (visited.has(nextUrl.href)) {
      throw new Error('Drupal JSON:API pagination cycle detected');
    }
    visited.add(nextUrl.href);

    const response = await fetchImpl(nextUrl, {
      headers: { Accept: 'application/vnd.api+json' },
    });
    if (!response.ok) {
      throw new Error(`Drupal JSON:API returned ${response.status}`);
    }

    const document = await response.json();
    if (!document || !Array.isArray(document.data)) {
      throw new Error('Drupal JSON:API document is missing a data array');
    }
    documents.push(document);

    const next = document.links?.next;
    const href = typeof next === 'string' ? next : next?.href;
    nextUrl = href ? new URL(href, nextUrl) : null;
  }

  return documents;
}

/**
 * Fetch published Drupal Articles for static generation.
 *
 * @param {{
 *   baseUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   limit?: number
 * }} options
 * @returns {Promise<DrupalArticle[]>}
 */
export async function fetchArticles({
  baseUrl = import.meta.env?.DRUPAL_BASE_URL,
  fetchImpl = fetch,
  limit = 10,
} = {}) {
  if (!baseUrl) {
    throw new Error('Missing DRUPAL_BASE_URL');
  }

  const endpoint = new URL('/jsonapi/node/article', baseUrl);
  endpoint.searchParams.set('filter[status]', '1');
  endpoint.searchParams.set('sort', '-created');
  endpoint.searchParams.set('page[limit]', String(limit));
  endpoint.searchParams.set(
    'fields[node--article]',
    'title,created,body',
  );

  return fetchJsonApiPages({
    initialUrl: endpoint,
    fetchImpl,
  });
}

/**
 * Extract the public Astro slug from a Pathauto alias.
 * Supports both /articles/... and /authors/... paths.
 *
 * @param {unknown} alias
 * @param {string} [prefix='/articles/'] - The expected path prefix
 * @returns {string|null}
 */
export function extractSlug(alias, prefix = '/articles/') {
  if (typeof alias !== 'string' || !alias.startsWith(prefix)) {
    return null;
  }

  const parts = alias.split('/').filter(Boolean);
  const prefixParts = prefix.split('/').filter(Boolean);
  return parts.length === prefixParts.length + 1 && parts[prefixParts.length] ? parts[prefixParts.length] : null;
}

/**
 * Extract the public Astro slug from an Article Pathauto alias.
 *
 * @param {unknown} alias
 * @returns {string|null}
 */
export function extractArticleSlug(alias) {
  return extractSlug(alias, '/articles/');
}

/**
 * Extract the public Astro slug from an Author Pathauto alias.
 *
 * @param {unknown} alias
 * @returns {string|null}
 */
export function extractAuthorSlug(alias) {
  return extractSlug(alias, '/authors/');
}

/**
 * Convert a category name to a URL-friendly slug.
 *
 * @param {string} name
 * @returns {string}
 */
export function slugifyCategory(name) {
  return name
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert filtered Drupal HTML to plain text.
 *
 * @param {unknown} html
 * @returns {string}
 */
export function htmlToPlainText(html) {
  const ENTITIES = [];
  ENTITIES.push([/&amp;/g, '&']);
  ENTITIES.push([/&nbsp;/g, ' ']);
  ENTITIES.push([/"/g, '"']);
  ENTITIES.push([/&#039;|'/g, "'"]);
  ENTITIES.push([/</g, '<']);
  ENTITIES.push([/>/g, '>']);
  let result = String(html ?? '').replace(/<[^>]*>/g, ' ');
  for (const [re, replacement] of ENTITIES) {
    result = result.replace(re, replacement);
  }
  return result.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
}

/**
 * Convert filtered Drupal HTML to a short plain-text summary.
 *
 * @param {unknown} html
 * @param {number} maxLength
 * @returns {string}
 */
export function createExcerpt(html, maxLength = 180) {
  const text = htmlToPlainText(html);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '').trim()}\u2026`;
}

const escapeAttribute = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const getAttributeValue = (attributes, name) => {
  const match = String(attributes ?? '').match(
    new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
};

const withUniqueSuffix = (base, usedIds) => {
  let id = base;
  let count = 2;

  while (usedIds.has(id)) {
    id = `${base}-${count}`;
    count++;
  }

  return id;
};

/**
 * Add anchor ids to article h1/h2 headings and return sidebar contents.
 *
 * @param {unknown} html
 * @returns {{ html: string, items: Array<{ id: string, level: number, text: string }> }}
 */
export function buildArticleContents(html) {
  const source = String(html ?? '');
  const usedIds = new Set();
  let headingIndex = 0;
  const items = [];
  const transformedHtml = source.replace(
    /<h([12])\b([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, level, attributes = '', content = '') => {
      const text = htmlToPlainText(content);
      if (!text) return match;

      headingIndex++;
      const existingId = getAttributeValue(attributes, 'id');
      const baseId = existingId || `article-${slugifyCategory(text) || `section-${headingIndex}`}`;
      const id = withUniqueSuffix(baseId, usedIds);
      const idAttribute = ` id="${escapeAttribute(id)}"`;
      const nextAttributes = getAttributeValue(attributes, 'id')
        ? attributes.replace(
            /\sid\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i,
            idAttribute,
          )
        : `${attributes}${idAttribute}`;

      usedIds.add(id);
      items.push({
        id,
        level: Number(level),
        text,
      });

      return `<h${level}${nextAttributes}>${content}</h${level}>`;
    },
  );

  return { html: transformedHtml, items };
}

const resourceKey = (resource) =>
  resource?.type && resource?.id ? `${resource.type}:${resource.id}` : null;

const findTaxonomyTerm = (included, identifier) => {
  const term = included.get(resourceKey(identifier));
  if (term) return term;
  if (!identifier?.id) return null;

  for (const [, resource] of included) {
    if (
      resource?.id === identifier.id &&
      resource?.type?.startsWith('taxonomy_term--')
    ) {
      return resource;
    }
  }

  return null;
};

const normalizeCategoryColor = (value) => {
  const raw =
    typeof value === 'string'
      ? value
      : Array.isArray(value)
        ? value[0]
        : typeof value?.color === 'string'
          ? value.color
          : typeof value?.value === 'string'
            ? value.value
            : null;
  const color = typeof raw === 'string' ? raw.trim() : '';
  return /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color)
    ? color
    : null;
};

const uniqueCategories = (categories) => {
  const seen = new Set();
  const result = [];

  for (const category of Array.isArray(categories) ? categories : []) {
    if (!category?.name || !category?.slug || seen.has(category.slug)) {
      continue;
    }
    seen.add(category.slug);
    result.push({
      name: category.name,
      slug: category.slug,
      ...(category.color ? { color: category.color } : {}),
    });
  }

  return result;
};

export function getArticleCategories(article) {
  const categories = uniqueCategories(article?.categories);
  if (categories.length > 0) return categories;
  if (article?.category && article?.categorySlug) {
    return [{ name: article.category, slug: article.categorySlug }];
  }
  return [];
}

const relatedKey = (value) =>
  String(value ?? '').trim().toLocaleLowerCase('el-GR');

const countSharedValues = (currentValues, candidateValues) => {
  let score = 0;
  for (const value of candidateValues) {
    if (currentValues.has(value)) score++;
  }
  return score;
};

const articleDateValue = (article) => {
  const value = Date.parse(article?.created ?? '');
  return Number.isNaN(value) ? 0 : value;
};

const compareRelatedMatches = (a, b) =>
  b.score - a.score || articleDateValue(b.article) - articleDateValue(a.article);

/**
 * Pick related articles, prioritizing shared tags and then shared categories.
 *
 * @param {{ id?: string, slug?: string, url?: string, tags?: string[], categories?: Array<{ slug: string }>, category?: string | null, categorySlug?: string | null }} article
 * @param {Array<any>} articles
 * @param {number} limit
 * @returns {Array<any>}
 */
export function getRelatedArticles(article, articles, limit = 3) {
  const max = Number.isInteger(limit) && limit > 0 ? limit : 3;
  const currentKeys = new Set(
    [article?.id, article?.slug, article?.url].filter(Boolean).map(String),
  );
  const currentTags = new Set(
    (Array.isArray(article?.tags) ? article.tags : [])
      .map(relatedKey)
      .filter(Boolean),
  );
  const currentCategories = new Set(
    getArticleCategories(article)
      .map((category) => relatedKey(category.slug))
      .filter(Boolean),
  );
  const selected = [];
  const selectedKeys = new Set();
  const candidates = (Array.isArray(articles) ? articles : []).filter((candidate) => {
    if (!candidate || candidate === article) return false;
    const candidateKeys = [candidate.id, candidate.slug, candidate.url]
      .filter(Boolean)
      .map(String);
    return !candidateKeys.some((key) => currentKeys.has(key));
  });

  const addMatches = (matches) => {
    for (const { article: match } of matches) {
      if (selected.length >= max) return;
      const key = String(match.id ?? match.slug ?? match.url ?? selected.length);
      if (selectedKeys.has(key)) continue;
      selectedKeys.add(key);
      selected.push(match);
    }
  };

  if (currentTags.size > 0) {
    addMatches(
      candidates
        .map((candidate) => ({
          article: candidate,
          score: countSharedValues(
            currentTags,
            (Array.isArray(candidate.tags) ? candidate.tags : [])
              .map(relatedKey)
              .filter(Boolean),
          ),
        }))
        .filter((match) => match.score > 0)
        .sort(compareRelatedMatches),
    );
  }

  if (selected.length < max && currentCategories.size > 0) {
    addMatches(
      candidates
        .map((candidate) => ({
          article: candidate,
          score: countSharedValues(
            currentCategories,
            getArticleCategories(candidate)
              .map((category) => relatedKey(category.slug))
              .filter(Boolean),
          ),
        }))
        .filter((match) => match.score > 0)
        .sort(compareRelatedMatches),
    );
  }

  if (selected.length < max) {
    addMatches(
      candidates
        .map((candidate) => ({ article: candidate, score: 0 }))
        .sort((a, b) => articleDateValue(b.article) - articleDateValue(a.article)),
    );
  }

  return selected;
}

/**
 * Normalize a Drupal JSON:API Article collection for Astro templates.
 *
 * @param {{ data?: Array<any>, included?: Array<any> }} document
 * @param {string} baseUrl
 * @returns {Array<{
 *   id: string,
 *   slug: string,
 *   url: string,
 *   title: string,
 *   created: string,
 *   bodyHtml: string,
 *   excerpt: string,
 *   image: null|{ url: string, alt: string, width: number|null, height: number|null },
 *   author: { id: string|null, name: string, slug: string, pictureUrl: string|null, email: string|null, profession: string|null, bio: string|null, shortBio: string|null, cv: null|{ url: string, filename: string, mimeType: string } },
 *   tags: string[],
 *   categories: Array<{ name: string, slug: string, color?: string }>,
 *   category: string | null,
 *   categorySlug: string | null
 * }>}
 */
export function normalizeBlogDocument(document, baseUrl) {
  if (!document || !Array.isArray(document.data)) {
    throw new Error('Drupal JSON:API document is missing a data array');
  }

  const included = new Map(
    (Array.isArray(document.included) ? document.included : [])
      .map((resource) => [resourceKey(resource), resource])
      .filter(([key]) => key),
  );
  const slugs = new Set();

  return document.data
    .filter((resource) => resource?.attributes?.status !== false)
    .map((resource) => {
      const attributes = resource.attributes ?? {};
      const relationships = resource.relationships ?? {};
      const slug = extractArticleSlug(attributes.path?.alias);

      if (!slug) {
        return null;
      }
      if (slugs.has(slug)) {
        throw new Error(`Duplicate Drupal article slug: ${slug}`);
      }
      slugs.add(slug);

      const imageIdentifier = relationships.field_image?.data;
      const imageFile = included.get(resourceKey(imageIdentifier));
      const imageMeta = imageIdentifier?.meta ?? {};
      const imagePath = imageFile?.attributes?.uri?.url;

      const authorIdentifier = relationships.uid?.data;
      const author = included.get(resourceKey(authorIdentifier));
      const authorPictureIdentifier =
        author?.relationships?.user_picture?.data;
      const authorPictureFile = included.get(
        resourceKey(authorPictureIdentifier),
      );
      const authorPicturePath = authorPictureFile?.attributes?.uri?.url;
      const authorCvIdentifier =
        author?.relationships?.field_viografiko?.data;
      const authorCvFile = included.get(resourceKey(authorCvIdentifier));
      const authorCvPath = authorCvFile?.attributes?.uri?.url;
      const authorCvMimeType = authorCvFile?.attributes?.filemime;

      const tagIdentifiers = Array.isArray(relationships.field_tags?.data)
        ? relationships.field_tags.data
        : [];
      const tags = tagIdentifiers
        .map((identifier) => included.get(resourceKey(identifier)))
        .map((tag) => tag?.attributes?.name)
        .filter(Boolean);

      const categoryRaw = relationships.field_katigoria_arthroy?.data;
      const categoryIdentifiers = Array.isArray(categoryRaw)
        ? categoryRaw
        : categoryRaw
          ? [categoryRaw]
          : [];
      const categories = uniqueCategories(
        categoryIdentifiers
          .map((identifier) => findTaxonomyTerm(included, identifier))
          .map((term) => {
            const name = term?.attributes?.name;
            if (!name) return null;
            return {
              name,
              slug: slugifyCategory(name),
              color: normalizeCategoryColor(
                term?.attributes?.field_hroma_katigorias,
              ),
            };
          })
          .filter(Boolean),
      );
      const category = categories[0]?.name ?? null;
      const categorySlug = categories[0]?.slug ?? null;

      const bodyHtml = attributes.body?.processed ?? '';

      return {
        id: resource.id,
        slug,
        url: `/blog/${slug}`,
        title: attributes.title ?? '',
        created: attributes.created ?? '',
        bodyHtml,
        excerpt: createExcerpt(bodyHtml),
        image: imagePath
          ? {
              url: new URL(imagePath, baseUrl).href,
              alt: imageMeta.alt || attributes.title || '',
              width: imageMeta.width ?? null,
              height: imageMeta.height ?? null,
            }
          : null,
        author: {
          id: author?.id ?? null,
          name: author?.attributes?.field_onomateponymo ?? author?.attributes?.display_name ?? 'Enterlife',
          slug: extractAuthorSlug(author?.attributes?.path?.alias) ?? author?.attributes?.display_name ?? 'unknown',
          pictureUrl: authorPicturePath
            ? new URL(authorPicturePath, baseUrl).href
            : null,
          email: author?.attributes?.field_email_epikoinonias_dimosio ?? null,
          cv:
            authorCvPath && authorCvMimeType === 'application/pdf'
              ? {
                  url: new URL(authorCvPath, baseUrl).href,
                  filename: authorCvFile?.attributes?.filename ?? 'cv.pdf',
                  mimeType: authorCvMimeType,
                }
              : null,
          profession: (() => {
            const v = author?.attributes?.field_epaggelma;
            if (!v) return null;
            if (typeof v === 'string') return v;
            if (typeof v === 'object' && v !== null) return v.value ?? v.processed ?? null;
            return null;
          })(),
          bio: (() => {
            const v = author?.attributes?.field_viografiko;
            if (!v) return null;
            if (typeof v === 'string') return v;
            if (typeof v === 'object' && v !== null) return v.value ?? v.processed ?? null;
            return null;
          })(),
          shortBio: (() => {
            const value =
              author?.attributes?.field_perigrafi_syntomo_viografi;
            const html =
              typeof value === 'string'
                ? value
                : value?.processed ?? value?.value ?? '';
            return htmlToPlainText(html) || null;
          })(),
        },
        tags,
        categories,
        category,
        categorySlug,
      };
    })
    .filter(Boolean);
}

/**
 * Fetch published Drupal Articles and their presentation relationships.
 *
 * @param {{
 *   baseUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   limit?: number - JSON:API page size; all next pages are fetched.
 * }} options
 */
export async function fetchBlogArticles({
  baseUrl = import.meta.env?.DRUPAL_BASE_URL,
  fetchImpl = fetch,
  limit = 50,
} = {}) {
  if (!baseUrl) {
    throw new Error('Missing DRUPAL_BASE_URL');
  }

  const endpoint = new URL('/jsonapi/node/article', baseUrl);
  endpoint.searchParams.set('filter[status]', '1');
  endpoint.searchParams.set('sort', '-created');
  endpoint.searchParams.set('page[limit]', String(limit));
  endpoint.searchParams.set(
    'include',
    'uid,uid.user_picture,uid.field_viografiko,field_image,field_tags,field_katigoria_arthroy',
  );
  endpoint.searchParams.set(
    'fields[user--user]',
    'display_name,field_onomateponymo,field_epaggelma,field_email_epikoinonias_dimosio,field_viografiko,field_perigrafi_syntomo_viografi,user_picture,path',
  );

  const documents = await fetchJsonApiDocuments({
    initialUrl: endpoint,
    fetchImpl,
  });
  const document = {
    data: documents.flatMap((page) => page.data),
    included: documents.flatMap((page) =>
      Array.isArray(page.included) ? page.included : [],
    ),
  };
  return normalizeBlogDocument(document, baseUrl);
}

/**
 * Derive unique blog categories with article counts from normalized articles.
 *
 * @param {Array<{ categories?: Array<{ name: string, slug: string, color?: string }>, category?: string | null, categorySlug?: string | null }>} articles
 * @returns {Array<{ name: string, slug: string, count: number }>}
 */
export function deriveBlogCategories(articles) {
  const catMap = new Map();

  for (const article of Array.isArray(articles) ? articles : []) {
    for (const category of getArticleCategories(article)) {
      if (!catMap.has(category.slug)) {
        catMap.set(category.slug, {
          name: category.name,
          slug: category.slug,
          count: 0,
        });
      }
      catMap.get(category.slug).count++;
    }
  }

  return Array.from(catMap.values());
}

/**
 * Fetch unique blog categories with their article counts.
 *
 * @param {{
 *   baseUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   limit?: number - JSON:API page size; all next pages are fetched.
 * }} options
 * @returns {Promise<Array<{ name: string, slug: string, count: number }>>}
 */
export async function fetchBlogCategories({
  baseUrl = import.meta.env?.DRUPAL_BASE_URL,
  fetchImpl = fetch,
  limit = 50,
} = {}) {
  const articles = await fetchBlogArticles({ baseUrl, fetchImpl, limit });
  return deriveBlogCategories(articles);
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   slug: string,
 *   pictureUrl: string|null,
 *   email: string|null,
 *   profession: string|null,
 *   bio: string|null,
 *   shortBio: string|null,
 *   cv: null|{ url: string, filename: string, mimeType: string },
 *   articleCount: number,
 *   articles: Array<{
 *     id: string,
 *     slug: string,
 *     url: string,
 *     title: string,
 *     created: string,
 *     excerpt: string,
 *     image: null|{ url: string, alt: string, width: number|null, height: number|null },
 *     tags: string[],
 *     categories: Array<{ name: string, slug: string, color?: string }>,
 *     author: { name: string }
 *   }>
 * }} Author
 */

/**
 * Fetch all unique authors and their articles from the blog.
 * Extracts author data from the included resources of article fetches.
 *
 * @param {{
 *   baseUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   limit?: number - JSON:API page size; all next pages are fetched.
 * }} options
 * @returns {Promise<Author[]>}
 */
export async function fetchAuthors({
  baseUrl = import.meta.env?.DRUPAL_BASE_URL,
  fetchImpl = fetch,
  limit = 50,
} = {}) {
  const articles = await fetchBlogArticles({ baseUrl, fetchImpl, limit });

  /** @type {Map<string, Author>} */
  const authorMap = new Map();

  for (const article of articles) {
    const { author } = article;
    if (!author.id) continue;

    if (!authorMap.has(author.id)) {
      authorMap.set(author.id, {
        id: author.id,
        name: author.name,
        slug: author.slug,
        pictureUrl: author.pictureUrl,
        email: author.email ?? null,
        profession: author.profession ?? null,
        bio: author.bio ?? null,
        shortBio: author.shortBio ?? null,
        cv: author.cv ?? null,
        articleCount: 0,
        articles: [],
      });
    }

    const entry = authorMap.get(author.id);
    entry.articleCount++;
      entry.articles.push({
        id: article.id,
        slug: article.slug,
      url: article.url,
      title: article.title,
      created: article.created,
        excerpt: article.excerpt,
        image: article.image,
        tags: article.tags,
        categories: article.categories,
        category: article.category,
        categorySlug: article.categorySlug,
        author: { name: author.name },
    });
  }

  return Array.from(authorMap.values());
}
