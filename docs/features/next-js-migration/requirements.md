# Requirements: Next.js Migration

## User stories

- As a business owner searching Google, I can find the ScheduleCore home page in search results, so that I discover the product.
- As a visitor on the home page, I can see what ScheduleCore does and navigate to sign up or log in, so that I can start using the product.
- As an authenticated business owner, I continue to use the dashboard with no change to existing functionality, so that the migration is invisible to me.
- As a developer, I can migrate the codebase incrementally phase by phase, so that existing features remain functional throughout.

## Acceptance criteria

- [ ] The home page (`/`) is server-rendered: `curl` returns complete HTML with visible content (not a blank `<div id="root">`).
- [ ] The home page has valid `<title>`, `<meta name="description">`, and Open Graph tags populated via `next/metadata`.
- [ ] `robots.txt` and `sitemap.xml` are served at their standard paths.
- [ ] All existing dashboard routes (`/services`, `/services/new`, `/services/:id`, `/services/:id/availability`, `/appointments`, `/staff`, `/staff/new`, `/staff/:id`) work identically after migration.
- [ ] Login flow (email + password → JWT → dashboard redirect) works identically after migration.
- [ ] Unauthenticated access to dashboard routes redirects to `/login`.
- [ ] `pnpm dev`, `pnpm build`, and `pnpm test` all succeed from the monorepo root with no errors.
- [ ] Existing test suite passes with no test deletions.
