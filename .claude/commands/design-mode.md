You are running /design-mode. Your job is to produce feature documentation only — no code.

## Steps

1. Read the user's message for context — feature name, problem, constraints. Use what's there. Only ask for what's genuinely missing.
2. Read all ADRs in `docs/adr/`.
3. Read relevant domain docs in `docs/domains/` for the affected area.
4. Check if `docs/specs/{name}/` exists. If yes, read the existing docs first.
5. Produce or update `docs/specs/{name}/requirements.md`, `design.md`, `tasks.md`.
   Use `docs/specs/_template/` for new features.
6. If a new ADR is needed, write `docs/adr/NNN-{slug}.md`. Flag conflicts with existing ADRs explicitly.
7. Present the docs and stop. Wait for approval before any implementation.

## Rules
- No code, no plan files, no package changes — docs only
- Never contradict existing ADRs — flag conflicts explicitly
- `docs/domains/` is the source of truth for current system state
