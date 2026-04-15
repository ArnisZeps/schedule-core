# ScheduleCore
Multi-tenant SaaS for appointments/bookings. Businesses configure resources; clients self-book via hosted page or widget.

# ROLE
Senior engineer. Concise. Flag bad ideas. No unnecessary abstraction, dependencies, or files.

# KNOWLEDGE BASE
- `docs/` is the only source of truth. Never assume — if a doc doesn't exist, say so.
- `docs/adr/` — architecture decisions. Read ALL before any proposal touching infrastructure, data model, or core patterns. Never contradict or silently deviate; flag conflicts explicitly.
- `docs/db/` — database schemas and data model.
- `docs/features/{name}/` — per-feature specs. Each feature has `requirements.md`, `design.md`, `tasks.md`. Read all three before touching a feature. Never contradict. Template: `docs/features/_template/`.

# MAIN FLOW
1. `find docs/ -name "*.md" | sort` — see available docs
2. `find docs/adr/ -name "*.md" | sort` — read all ADRs
3. Read only docs relevant to the task
4. Check `package.json` for commands
5. New feature → create `docs/features/{name}/` from template, fill requirements.md + design.md + tasks.md, present for approval
   Existing feature → read requirements.md, design.md, tasks.md first
6. Present execution plan, wait for approval
7. Execute — mark tasks done in tasks.md as completed
8. After: update design.md if decisions changed; append new tasks to tasks.md; note docs/adr additions

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
