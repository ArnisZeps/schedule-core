# Design: M8 - Registration Page

## Problem

Business owners need a public-facing page to create a ScheduleCore account. The API (`POST /api/auth/signup`, M3) and auth infrastructure (JWT, `AuthContext`) exist; only the UI is missing. The slug field requires client-side auto-derivation from the business name to reduce friction.

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/app/(auth)/register/page.tsx` | Thin shell — imports `RegisterPage`, marks `'use client'` |
| `apps/web/src/page-components/RegisterPage.tsx` | Registration form: business name, slug, email, password. Slug auto-derives from business name until manually edited. Calls `POST /api/auth/signup`. |
| `apps/web/src/page-components/__tests__/RegisterPage.test.tsx` | RTL tests covering all acceptance criteria |
| `apps/web/src/page-components/LoginPage.tsx` | Add "Don't have an account? Register" link pointing to `/register` |

## Contracts

No new API endpoints or schema changes. Calls the existing endpoint:

### `POST /api/auth/signup`

**Request**
```json
{
  "businessName": "string",
  "slug": "string (lowercase alphanumeric + hyphens, 3–50 chars)",
  "email": "string",
  "password": "string (min 8 chars)"
}
```

**Responses:** `201 { token }`, `409 email_taken`, `409 slug_taken`, `422 validation_error` (details array may include `"slug_reserved"`).

## Slug derivation

Derived from business name on every `onChange`: trim → lowercase → replace non-alphanumeric with hyphens → collapse consecutive hyphens → trim leading/trailing hyphens.

Example: `"Acme Barber Shop!"` → `"acme-barber-shop"`.

A `slugManuallyEdited` boolean in component state tracks whether the user has edited the slug field directly. Once set, business name changes no longer overwrite the slug.

## Rejected alternatives

**Real-time slug availability check** — rejected. Adds a debounced API call, loading indicator, and a new endpoint for a feature with negligible value at MVP user volumes. The 409 response on submit is sufficient feedback.

**Confirm password field** — rejected. Adds friction; password managers fill correctly without it. Password reset is post-MVP regardless.

**Middleware-based auth redirect** — rejected. Would require JWT in a cookie, contradicting ADR-007. The existing `UnauthenticatedOnly` client-side pattern (identical to `/login`) is used instead.

## Trade-offs accepted

- Slug validation is client-side (Zod) + server-side (API 409/422). No intermediate availability check.
- `slugManuallyEdited` is component state, not a ref — it resets on unmount, which is acceptable since the form is discarded anyway.

## Out of scope

- Email verification after signup
- Password strength indicator beyond min-8 validation
- Terms of service checkbox
- Real-time slug availability check
- Confirm password field

## Edge cases

- Business name that derives to a slug shorter than 3 chars (e.g. `"AB"`) → slug field fails Zod validation on submit; user must manually lengthen it.
- Business name consisting entirely of special characters → derived slug is empty → caught as too short by Zod.
- Reserved slug → API returns `422` with `details: ["slug_reserved"]` → show "This URL is reserved" on the slug field.
- Concurrent signup with the same email → API returns `409 email_taken` → inline error on the email field.
