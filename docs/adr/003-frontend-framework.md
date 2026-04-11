# ADR 003 — Frontend Framework: Vite + React

**Date:** 2026-04-11
**Status:** Accepted

## Context

The web app is a SaaS dashboard. Options considered: Next.js (SSR), Vite + React (SPA), Remix.

## Decision

Use **Vite 5 + React 18** (SPA, no SSR).

- SSR is unnecessary for an authenticated dashboard; it adds deployment complexity with no SEO benefit.
- Vite's HMR is fast; no config overhead.
- `@vitejs/plugin-react` for JSX transform.
- Dev server on port 3000, API on 3001 — no proxy config needed during early dev.

## Consequences

- All routing is client-side; add `react-router-dom` when routes are needed.
- No built-in data fetching — add `@tanstack/react-query` when API calls are needed.
- Bundle split and lazy loading handled by Vite automatically for production.
