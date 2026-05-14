# Requirements: fix-logout-crash

## User stories

- As a business owner, when I click logout, I want to be redirected to the login page without any runtime error.

## Acceptance criteria

- [ ] Clicking logout navigates to `/login` without throwing a TypeError
- [ ] No dashboard content (pages, components, hooks) remains rendered during the navigation transition after logout
- [ ] Manual navigation to a dashboard URL without a valid token redirects to `/login` and renders nothing
