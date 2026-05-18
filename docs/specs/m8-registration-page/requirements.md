# Requirements: M8 - Registration Page

## User stories

- As a new business owner, I want to create a ScheduleCore account, so that I can start managing my appointments.
- As a new business owner, I want my business URL slug auto-filled from my business name, so that I don't have to type it manually.
- As a new business owner, I want to correct my slug before submitting, so that I can pick a more accurate or shorter URL.
- As a returning user who lands on `/register`, I want to be redirected to the dashboard, so that I don't see an irrelevant form.

## Acceptance criteria

- [ ] `/register` renders a form with four fields: Business name, Slug, Email, Password.
- [ ] As the user types in Business name, the Slug field updates automatically (lowercase, hyphens, alphanumeric only).
- [ ] The user can manually edit the Slug field; manual edits are not overwritten by subsequent business name changes.
- [ ] Submitting calls `POST /api/auth/signup` with `{ businessName, slug, email, password }`.
- [ ] On success (201), `login(token)` is called and the user is redirected to `/services`.
- [ ] On `409 email_taken`, an inline error "Email already registered" appears on the email field.
- [ ] On `409 slug_taken`, an inline error "This URL is already taken" appears on the slug field.
- [ ] On `422` with `slug_reserved`, an inline error "This URL is reserved" appears on the slug field.
- [ ] The submit button is disabled while the request is in-flight and shows "Creating account…".
- [ ] An authenticated user visiting `/register` is redirected to `/services`.
- [ ] The page includes a link to `/login` for users who already have an account.
- [ ] The login page at `/login` includes a link to `/register` for new users.
