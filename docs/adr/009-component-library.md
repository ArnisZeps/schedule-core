# ADR 009 — Component Library: shadcn/ui

**Date:** 2026-05-01
**Status:** Accepted

## Context

M5c introduces a proper design system. A component library decision is required: the chosen
library must support Tailwind CSS (ADR-003), carry accessibility primitives, and not introduce
a runtime theme provider that conflicts with Tailwind's utility approach.

## Decision

Adopt **shadcn/ui** with the New York style variant.

shadcn/ui is a collection of copy-paste components built on **Radix UI** primitives and styled
with Tailwind CSS variables. Components are added to the repo via CLI (`npx shadcn@latest add
<component>`) and owned by the project — there is no runtime library dependency.

- **Accessibility:** Radix UI handles ARIA roles, keyboard navigation, and focus management.
- **Theming:** CSS custom properties in `index.css`. Changing the accent color is one variable
  edit and propagates everywhere.
- **Ownership:** Components live in `src/components/ui/`. They can be modified freely; no
  upstream version to pin.
- **Ecosystem:** react-hook-form + zod for forms; sonner for toasts — both shadcn-recommended
  and well-maintained.

## Consequences

- `npx shadcn@latest add <component>` must be run to add new components as the app grows.
  This is intentional — only components in use are in the codebase.
- Updating a component requires re-running the add command and reviewing the diff.
- `react-hook-form`, `@hookform/resolvers`, `zod`, `lucide-react`, and `sonner` are added as
  `apps/web` dependencies.

## Rejected alternatives

**Headless UI (Tailwind Labs)** — fewer components, no table, no dialog with built-in focus
management; Radix UI is more complete.

**Material UI / Chakra UI** — runtime CSS-in-JS or a custom theme provider; clashes with
Tailwind's approach and adds significant bundle weight.

**Pure custom Tailwind** — no accessibility primitives; building keyboard-accessible dropdowns,
dialogs, and selects from scratch is high effort with high risk of missing edge cases.
