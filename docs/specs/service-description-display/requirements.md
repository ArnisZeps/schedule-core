# Requirements: service-description-display

Two display bugs in how a service `description` is rendered. The data is correct in both cases — only presentation is wrong.

## User stories

- As a client on the public booking page, I want a service description with multiple lines to render with its line breaks, so that the description is readable instead of being collapsed into one run-on line.
- As an owner on the admin Services page, I want long descriptions to be truncated within the table, so that the row actions button (three-dots menu) stays reachable without horizontal scrolling.

## Acceptance criteria

### Public booking page (`ServiceSection`)
- [ ] A description containing newlines (`\n`) renders each line on its own line.
- [ ] Consecutive spaces and existing wrapping behaviour are otherwise unchanged (no forced monospace, no horizontal overflow).
- [ ] Services with no description render exactly as before.

### Admin Services table (`ServiceListPage`)
- [ ] The description cell never grows the table wide enough to push the actions column off-screen, regardless of description length.
- [ ] A long description is truncated to a single line with a trailing ellipsis.
- [ ] Newlines in the description do not introduce extra row height in the table (collapsed to single line).
- [ ] The full untruncated description is available on hover (native `title` tooltip).
- [ ] Services with no description still render the `—` placeholder.
