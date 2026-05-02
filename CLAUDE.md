# ScheduleCore
Multi-tenant SaaS for appointments/bookings. Businesses configure resources; clients self-book via hosted page or widget.

Stack: pnpm monorepo, Express/Node (`apps/api`), Vite+React (`apps/web`), Neon PostgreSQL via `Pool` client (`packages/db`), raw SQL — no ORM.

# ROLE
Senior engineer. Concise. Flag bad ideas. No unnecessary abstraction, dependencies, or files.

# KNOWLEDGE BASE
- `docs/` is the only source of truth. Never assume — if a doc doesn't exist, say so.
- `docs/adr/` — architecture decisions. Read ALL before any proposal touching infrastructure, data model, or core patterns. Never contradict or silently deviate; flag conflicts explicitly.
- `docs/db/` — database schemas and data model.
- `docs/features/{name}/` — per-feature specs. Each feature has `requirements.md`, `design.md`, `tasks.md`. Read all three before touching a feature. Mark each task done immediately on completion — before starting the next. Never contradict. Template: `docs/features/_template/`.
- `docs/roadmaps/mvp/roadmap.md` — roadmap for MVP

# RULES
- Rules are critical and cannot be skipped.
- Read only docs that are needed to solve the task.
- No code before an approved design doc (`docs/features/{name}/`).
- `tasks.md` is a strict guideline. Do not take next task without marking previous as done. 
- TDD is mandatory: write tests first, present them to the user, wait for approval, then implement. See `docs/testing.md`.
- Never make quick fixes or workarounds. Each problem should be resolved at the core layer.
- Never edit this file without permission.
