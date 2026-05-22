# Requirements: Invalid Credentials Warning

## User stories

- As a business owner, I want to see a clear error message when my email or password is wrong, so that I know I need to correct my credentials rather than wonder why nothing happened.

## Acceptance criteria

- [ ] Submitting the login form with incorrect credentials displays "Incorrect email or password." inline — no page reload, no redirect.
- [ ] The error message does not indicate which field is wrong (no enumeration — matches API contract).
- [ ] The error message appears below the password field and above the submit button (in the existing `errors.root` slot).
- [ ] The submit button re-enables after the error appears; the user can retry without refreshing.
- [ ] The error clears automatically on the next submit attempt.
- [ ] Non-credential failures (network error, unexpected server error) still show the fallback "Login failed" message.
