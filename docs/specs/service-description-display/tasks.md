# Tasks: service-description-display

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-06-24 Initial implementation

- [x] Write/adjust tests first (TDD): public `ServiceSection` renders newlines (assert `whitespace-pre-line` on the description element); admin `ServiceListPage` description cell truncates and exposes full text via `title`. Present tests for approval before implementing.
- [x] Public page: add `whitespace-pre-line` to the description `<div>` in `ServiceSection.tsx`.
- [x] Admin table: wrap the description cell text in a `max-w` + `truncate` element with `title={description}` in `ServiceListPage.tsx`; keep the `—` placeholder for null. (Used canonical `max-w-lg` = 32rem per lint suggestion.)
- [x] Run the relevant component tests and lint; confirm green. (44/44 pass in booking + services suites.)
- [x] Update `docs/domains/services.md` and `docs/domains/booking-widget.md` if any documented component behaviour changed (note description truncation in the admin table and newline rendering on the public card).
