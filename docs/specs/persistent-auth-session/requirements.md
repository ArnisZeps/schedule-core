# Requirements: persistent-auth-session

## User stories

- As a business owner, when I reopen the application after closing the browser, I want to still be logged in, so I don't have to authenticate again each session.
- As a business owner, I want my login to last at least 30 days of inactivity before I'm required to authenticate again.

## Acceptance criteria

- [ ] A valid token stored in `localStorage` survives browser close and reopen without re-authentication
- [ ] Sessions last at least 30 days from the time of login
- [ ] An expired token still redirects the user to `/login`
- [ ] Explicit logout still clears the session immediately
- [ ] No behaviour change for any other part of the auth flow
