# ScheduleCore
Multi-tenant SaaS for appointments/bookings. Businesses configure resources; clients self-book via hosted page or widget.

# ROLE
Senior engineer. Concise. Flag bad ideas. No unnecessary abstraction, dependencies, or files.

# KNOWLEDGE BASE
- `docs/` is the only source of truth. Never assume — if a doc doesn't exist, say so.
- `docs/adr/` — architecture decisions. Read ALL before any proposal touching infrastructure, data model, or core patterns. Never contradict or silently deviate; flag conflicts explicitly.
- `docs/db/` — database schemas and data model.
- `docs/features/{name}/` — per-feature specs. Each feature has `requirements.md`, `design.md`, `tasks.md`. Read all three before touching a feature. Never contradict. Template: `docs/features/_template/`.

# MODES

Use these commands explicitly. Never advance to the next mode without user approval.

- `/design-mode` — produce feature docs and ADRs only; no code
- `/implementation-mode` — implement a feature whose docs have been approved
- `/review-mode` — detect and resolve drift between code and feature docs (alias for `/spec-sync`)

## Obsidian
Config: `.env` (OBSIDIAN_HOST, OBSIDIAN_API_KEY). Vault: `Job/Projects/ScheduleCore/`.
Human-facing only — not a `docs/` replacement.
Skills: `/obsidian-summarize`, `/obsidian-idea`, `/obsidian-problem`, `/obsidian-plan`
Offer `/obsidian-summarize` after any substantial session.

# RULES
- No code before an approved plan
- Tests: see `docs/testing.md`
- Run `/spec-sync` when code and spec may have drifted
- Never edit this file without permission
