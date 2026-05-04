# Tasks: m5c-ui-polish

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-01 Initial implementation

### Phase 0 — Setup
- [x] Install shadcn/ui (npx shadcn@latest init — New York style, slate+blue)
- [x] Install shadcn components: button input label card table dialog alert-dialog select badge separator skeleton avatar dropdown-menu sonner form
- [x] Install lucide-react
- [x] Install react-hook-form @hookform/resolvers zod (web app)
- [x] Write docs/adr/009-component-library.md
- [x] Add M5c entry to docs/roadmaps/mvp/roadmap.md

### Phase 0b — Layout primitives & state components
- [x] src/components/layout/PageShell.tsx
- [x] src/components/layout/PageHeader.tsx
- [x] src/components/layout/PageContent.tsx
- [x] src/components/ui/LoadingState.tsx
- [x] src/components/ui/EmptyState.tsx
- [x] src/components/ui/ErrorState.tsx

### Phase 1 — Design tokens
- [x] src/index.css — full CSS variable token set (colors, radius, shadows, typography)
- [x] Verify tailwind.config.js wired to shadcn tokens

### Phase 2 — Layout & Navigation
- [x] AppLayout.tsx — breadcrumb, user dropdown menu
- [x] Sidebar.tsx — lucide icons, user email + avatar at bottom

### Phase 3 — Forms & Inputs
- [x] LoginPage.tsx — Card wrapper, RHF + zod, per-field validation
- [x] ServiceFormPage.tsx — Card wrapper, RHF + zod, toast on save
- [x] AvailabilityPage.tsx — shadcn Select + Input, toast on add/delete

### Phase 4 — Tables & Lists
- [x] ServiceListPage.tsx — shadcn Table, AlertDialog delete, EmptyState, LoadingState, DropdownMenu row actions, toast on delete

### Phase 5 — Feedback & Toasts
- [x] main.tsx — add <Toaster /> (sonner)
- [x] Verify all success/error paths emit a toast

### Phase 6 — Verification
- [x] All RTL tests green (pnpm --filter web test) — fix any broken by component text/role changes
- [x] pnpm typecheck passes
- [x] Manual: login, create/edit/delete service, availability, mobile sidebar, toasts visible
