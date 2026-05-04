# Design: m5c-ui-polish

## Problem

M5a built a functional dashboard with minimal Tailwind styling. Colors are hardcoded throughout,
there is no feedback layer (no toasts, no loading skeletons, no confirmation dialogs), and no
shared layout primitives — each page invents its own markup. The result feels like an internal
prototype, not a sellable product. Future milestones (M5b, M6, M7) will add more pages; without a
design system those pages will compound the inconsistency.

## Approach

Adopt **shadcn/ui** (Radix UI primitives + Tailwind CSS variables). Components live in the repo,
are fully customizable, and carry accessibility (ARIA, keyboard, focus management) for free.
Establish layout primitives and state components before touching any page so future pages compose
rather than copy. See ADR-009.

**Style:** New York variant. Slate base, blue-600 accent.
**Icons:** lucide-react.
**Toasts:** sonner.
**Forms:** react-hook-form + @hookform/resolvers + zod.

## Components

### New layout primitives

| File | Responsibility |
|------|----------------|
| `src/components/layout/PageShell.tsx` | Consistent max-width + vertical padding wrapper |
| `src/components/layout/PageHeader.tsx` | Title + optional subtitle + optional right action slot |
| `src/components/layout/PageContent.tsx` | Content area with consistent spacing |

### New state components

| File | Responsibility |
|------|----------------|
| `src/components/ui/LoadingState.tsx` | Skeleton rows (configurable count) |
| `src/components/ui/EmptyState.tsx` | Icon + title + description + optional CTA |
| `src/components/ui/ErrorState.tsx` | Error message + optional retry action |

### shadcn/ui components installed

Button, Input, Label, Card, Table, Dialog, AlertDialog, Select, Badge, Separator, Skeleton,
Avatar, DropdownMenu, Sonner (Toaster), Form (wraps react-hook-form)

### Modified pages/components

| File | Change |
|------|--------|
| `src/index.css` | Full CSS variable token set (colors, radius, shadows) |
| `src/main.tsx` | Add `<Toaster />` (sonner) |
| `src/components/AppLayout.tsx` | Use shadcn layout; breadcrumb wired to route |
| `src/components/Sidebar.tsx` | Lucide icons; user email + avatar at bottom |
| `src/pages/LoginPage.tsx` | Card wrapper; RHF + zod; per-field validation |
| `src/pages/services/ServiceListPage.tsx` | shadcn Table; AlertDialog delete; EmptyState; LoadingState; DropdownMenu row actions; toast on delete |
| `src/pages/services/ServiceFormPage.tsx` | Card wrapper; RHF + zod; toast on save |
| `src/pages/services/AvailabilityPage.tsx` | shadcn Select + Input; toast on add/delete |

## Contracts

No API or data model changes. Pure UI layer refactor. Existing hooks (useServices,
useAvailabilityRules, etc.) are unchanged. toast() calls are fire-and-forget side effects.

## Rejected alternatives

**MUI / Chakra UI** — runtime CSS-in-JS or theme provider clashes with Tailwind; bundle cost.
**Headless UI** — fewer components than Radix/shadcn; same primitives, less complete.
**Pure custom Tailwind** — no accessibility primitives, high effort for the same visual result.
**Vite proxy to avoid CORS** — already rejected by ADR-003; unrelated to this milestone.

## Trade-offs accepted

- shadcn/ui components are copied into the repo — updating to new shadcn versions requires
  re-running `npx shadcn@latest add` per component. Accepted: full control over the component
  source outweighs version management convenience.
- react-hook-form adds a new web-only dep. Accepted: zod is already used in the API; aligning
  on the same validation library is a long-term win.
- RTL tests that query by text may need minor updates where button/label text changes.

## Out of scope

- Dark mode (not in scope for MVP)
- Animation library (CSS transitions only)
- Table sorting, filtering, pagination (M5b+ concern)
- Accessibility audit beyond what Radix provides automatically
- i18n

## Edge cases

- EmptyState CTA link must be a router `<Link>`, not a button, to preserve navigation semantics.
- AlertDialog must manage its own open state locally to avoid lifting state into the page.
- sonner Toaster must be rendered outside the router to survive route transitions.
- Breadcrumb on `/services/new` should show "Services / New"; on `/services/:id` should show
  "Services / Edit" (not the service name, which requires an extra fetch).
