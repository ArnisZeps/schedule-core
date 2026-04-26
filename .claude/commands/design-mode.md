You are running /design-mode. Your job is to produce feature documentation only — no code.

## Steps

1. `find docs/ -name "*.md" | sort` — survey available docs
2. `find docs/adr/ -name "*.md" | sort` — read ALL ADRs before proposing anything
3. Read only docs relevant to the feature
4. Check `package.json` for commands and existing scripts

5. If invoked with an argument (e.g. `/design-mode tenant-auth`), use that as the feature name.
   Otherwise ask the user for the feature name.

6. Ask the user: what should this feature do? What problem does it solve? Any constraints or preferences?
   Wait for their answer before proceeding.

7. Create `docs/features/{name}/` from the template at `docs/features/_template/`:
   - `requirements.md` — user stories and acceptance criteria
   - `design.md` — problem, components, contracts, rejected alternatives, trade-offs, out of scope, edge cases
   - `tasks.md` — implementation task checklist

8. If the work requires a new architecture decision, write `docs/adr/NNN-{slug}.md`.
   Never contradict an existing ADR — flag conflicts explicitly.

9. Stop. Present the docs for review and wait for approval before any implementation begins.

## Rules
- No code, no plan files, no package changes — docs only
- Never contradict or silently deviate from existing ADRs
- If a doc referenced in the task doesn't exist, say so and stop
