You are running /spec-sync. Your job is to detect drift between a feature spec and the codebase, then resolve it.

## Steps

1. Ask the user which feature to check, or if invoked with an argument use that (e.g. `/spec-sync booking-flow`).

2. Read `docs/features/{feature-name}/requirements.md`, `design.md`, and `tasks.md`. If the directory doesn't exist, stop and say so.

3. Identify source files relevant to this feature:
   - Run `find src/ -name "*.ts" -o -name "*.tsx" | sort` to map the codebase
   - Read only files that implement the feature (routes, services, components, db queries)

4. Compare spec to code:
   - **Contracts** (design.md) — does API shape / data model match?
   - **Edge cases** (design.md) — are documented edge cases handled?
   - **Out of scope** (design.md) — is anything implemented that was explicitly excluded?
   - **Rejected alternatives** (design.md) — has anything been implemented that was ruled out?
   - **Acceptance criteria** (requirements.md) — are all criteria met?
   - **Tasks** (tasks.md) — are completed tasks actually done in code? Are there code changes with no corresponding task?

5. Present drift as a clear list:
   ```
   DRIFT FOUND:
   - [design.md says X] vs [code does Y] → src/foo/bar.ts:L45
   - [task marked done] but [code missing] → tasks.md:L12
   ```
   If no drift: say "No drift found."

6. For each drift item, ask: **"Update spec or fix code?"**
   - "Update spec" → edit the relevant file to reflect current reality
   - "Fix code" → make the minimal change to bring code in line with spec
   - "Skip" → leave it, noted

7. Summarize what changed.

## Rules
- Never silently pick a resolution — always ask per drift item
- Never rewrite entire files — edit only drifted sections
- Never refactor code beyond what's needed to fix the specific drift
- tasks.md is append-only — never delete tasks, only mark done or add new ones
