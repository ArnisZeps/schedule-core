# ADR 008 — CORS Policy

**Date:** 2026-05-01
**Status:** Accepted

## Context

The web frontend (port 3000) makes requests to the API (port 3001). These are different origins, so the browser enforces CORS. ADR-003 explicitly ruled out a Vite dev proxy, meaning CORS headers are required at the API layer.

## Decision

The API sets CORS headers via a hand-written middleware in `app.ts`. Allowed origins are read from the `ALLOWED_ORIGINS` environment variable (comma-separated list). The default is `http://localhost:3000` for local development.

```
ALLOWED_ORIGINS=http://localhost:3000
```

For staging or production, set the env var to the deployed frontend origin(s):

```
ALLOWED_ORIGINS=https://app.example.com
```

The `Vary: Origin` header is set whenever a matching origin is reflected, so CDN/proxy caches don't serve the wrong CORS header to a different origin.

## Rejected alternatives

**Reflect any origin** — insecure; allows any domain to make credentialed requests to the API.

**`cors` npm package** — the required logic is ~10 lines; adding a dependency is not warranted.

**Vite proxy** — ruled out by ADR-003 (dev server on 3000, API on 3001, no proxy).

## Consequences

- All production deployments must set `ALLOWED_ORIGINS` explicitly.
- `ALLOWED_ORIGINS` must be added to any CI/CD environment configuration.
- Unrecognised origins receive no `Access-Control-Allow-Origin` header and are blocked by the browser.
