# Design: service-description-display

## Problem
Service `description` is stored and returned faithfully (including newlines), but two views render it poorly:

1. **Public booking page** — `ServiceSection.tsx:46` renders the description in a `<div>` with the default `white-space: normal`, so authored line breaks collapse and the text becomes one paragraph.
2. **Admin Services table** — `ServiceListPage.tsx:100-102` places the full description in a `TableCell` with no width constraint. The table uses CSS auto layout, so a long description widens the column and pushes the actions column (three-dots `DropdownMenu`) off the visible area, forcing horizontal scroll to reach it.

Both are pure CSS/markup presentation fixes. No API, hook, or data-model changes.

## Components

| File | Responsibility |
|------|----------------|
| `apps/web/src/page-components/booking/ServiceSection.tsx` | Add `whitespace-pre-line` to the description `<div>` so `\n` renders as line breaks while still wrapping normally. |
| `apps/web/src/page-components/services/ServiceListPage.tsx` | Constrain the description cell: wrap the text in an element with a `max-w` + `truncate` (single-line ellipsis) and a native `title` holding the full text. |

## Contracts
No API, hook, or schema changes. `PublicService.description` and `Service.description` keep their existing `string | null` shape. Purely presentational changes within two client components.

## Approach detail

### Public page
Change the description container to apply `whitespace-pre-line`:
- `pre-line` (not `pre` / `pre-wrap`) collapses runs of spaces like normal text but preserves newlines, and still wraps long lines to the card width — matching authoring intent without monospace blocks or horizontal overflow.

### Admin table
Truncation must survive the table's auto layout. The cell content is wrapped in a block element that:
- has a `max-w-[…]` cap (e.g. a fixed rem/px max width) so the column cannot grow unbounded,
- uses `truncate` (`overflow-hidden text-ellipsis whitespace-nowrap`) to collapse newlines and clip overflow to one line,
- carries `title={description}` so the full text is available on hover.

The `—` placeholder for null descriptions is kept (no truncation needed).

## Rejected alternatives
- **`line-clamp-2` (multi-line clamp) on the table cell** — still requires a width cap to prevent column growth, and multi-line rows make the table taller and noisier. Single-line `truncate` is the cleaner, more predictable fit for a dense admin table.
- **Switching the table to `table-fixed` layout** — would force explicit widths on every column and risks regressions in the Name/actions columns. Scoping the constraint to the description cell is lower-risk.
- **Rendering description as Markdown / rich text on the public page** — out of scope; descriptions are plain text. `whitespace-pre-line` is the minimal correct fix for the reported newline bug.
- **Truncating the public booking card description** — not requested; cards are not width-constrained the way a table row is, and the full description is useful context when choosing a service.

## Trade-offs accepted
- The admin table shows only the first line of a description; the rest is hover-only (`title`). Acceptable for a list view whose primary job is navigation to the edit page.
- The public card grows vertically with long multi-line descriptions. Acceptable and intended — readability is the goal there.

## Out of scope
- Description editing/validation (`ServiceFormPage`) is unchanged.
- Markdown or rich-text rendering.
- Any change to the public card's full-description display beyond honoring newlines.

## Edge cases
- **Null/empty description** — public card already conditionally renders (`svc.description &&`); table keeps the `—` placeholder. No change in behaviour.
- **Description with newlines, admin table** — `truncate`'s `whitespace-nowrap` collapses newlines so the row stays single-height; full text still in `title`.
- **Very long single word (no spaces), public card** — `whitespace-pre-line` still allows normal wrapping; combined with the card's existing layout it does not overflow horizontally (existing behaviour preserved).
- **Very long single word, admin table** — `truncate` clips with ellipsis regardless of word boundaries.
