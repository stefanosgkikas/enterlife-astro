# Enterlife Astro frontend

Static Astro frontend for the Enterlife Drupal 11 JSON:API backend. Production
is deployed to the Cloudflare Pages project `enterlife-astro`.

## Local development

Copy `.env.example` to `.env` and keep the local Drupal origin:

```text
DRUPAL_BASE_URL=http://admin.enterlife.localhost
PUBLIC_SITE_URL=http://enterlife.localhost
```

Then run:

```powershell
npm install
npm run dev
```

## Verify and deploy

```powershell
npm test
npm run build
npm run deploy
```

`npm run deploy` requires a one-time `npx wrangler login`. The production
Cloudflare build environment must use the public Drupal URL, not a localhost
address.

For the GitHub-connected `enterlife-astro` Pages project use:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | blank (repository root) |
| Build command | `npm run build` |
| Build output directory | `dist` |

Set `DRUPAL_BASE_URL=https://admin.enterlife.gr` and
`PUBLIC_SITE_URL=https://enterlife.gr` for both Production and Preview. A
Cloudflare Pages Deploy Hook for `main` can then be stored privately in Drupal
and called by the `enterlife_build_webhook` module after content changes.
