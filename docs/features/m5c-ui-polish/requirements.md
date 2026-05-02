# Requirements: m5c-ui-polish

## User stories

- As a business owner, I want the dashboard to look professional so that I trust the product and feel confident showing it to others.
- As a business owner, I want clear feedback when I save, delete, or encounter an error so that I always know what happened.
- As a business owner, I want form validation to catch mistakes before I submit so that I don't lose work to a failed request.
- As a business owner, I want delete actions to ask for confirmation in a proper dialog so that I don't accidentally remove data.
- As a business owner, I want consistent loading indicators so that the app never feels broken while data is fetching.

## Acceptance criteria

- [ ] All pages use a consistent layout structure (PageShell, PageHeader, PageContent)
- [ ] Design tokens (colors, radius, shadows) are defined as CSS variables — no hardcoded Tailwind color classes in page components
- [ ] Login, resource, and availability forms use react-hook-form + zod with per-field validation messages shown on blur
- [ ] Delete confirmation uses a modal AlertDialog, not window.confirm
- [ ] Success and error outcomes show a toast notification via sonner
- [ ] Loading states show skeleton rows, not plain "Loading…" text
- [ ] Empty states show an icon, title, and a CTA action link
- [ ] Sidebar shows nav icons and the logged-in user's email
- [ ] Header shows a user dropdown menu with a "Sign out" option
- [ ] All existing RTL tests pass after the refactor
- [ ] pnpm typecheck passes with zero errors
