You are running /implementation-mode. Your job is to implement a feature whose docs have already been approved.

## Steps

1. If invoked with an argument (e.g. `/implementation-mode tenant-auth`), use that as the feature name.
   Otherwise ask the user for the feature name.

2. Read `docs/features/{name}/requirements.md`, `design.md`, and `tasks.md`.
   If any file is missing, stop and say so — run /design-mode first.

3. Read all ADRs in `docs/adr/` that are relevant to this feature.

4. Check `package.json` for existing commands (test runner, build, etc.).

5. The feature docs are the plan. Implement exactly what is specified:
   - Follow the component list and contracts in design.md
   - Do not add features, abstractions, or files beyond what is documented
   - Do not contradict rejected alternatives or out-of-scope items

6. As each task is completed, mark it done in tasks.md.

7. Run tests after implementation. See `docs/testing.md` for test requirements.

8. After implementation:
   - Update design.md if any decisions changed during implementation
   - Append any new tasks discovered to tasks.md (never delete existing tasks)
   - Note any new ADRs written

## Rules
- No code before reading all three feature docs
- Tests are required — never mark a feature complete without them
- tasks.md is append-only — never delete tasks, only mark done or add new ones
- Flag any contradiction between the docs and ADRs before proceeding
