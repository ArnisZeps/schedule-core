# Tasks: M2 — Migration Tooling

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-04-15 Initial implementation

- [x] Write ADR-006 (docs/adr/006-migration-runner.md)
- [x] Create docs/features/m2-migration-tooling/ (requirements, design, tasks)
- [x] Create packages/db/migrations/0001_initial_schema.sql
- [x] Write packages/db/src/migrator.test.ts (TDD — tests first)
- [x] Implement packages/db/src/migrator.ts
- [x] Implement packages/db/src/migrate.ts (CLI)
- [x] Update packages/db/src/schema.test.ts to use migrator instead of readFileSync
- [x] Add tsx devDependency and migrate:up / migrate:status scripts to packages/db/package.json
- [x] Verify all tests pass
- [x] Smoke test: migrate:status, migrate:up, migrate:status (shows applied), migrate:up (no-op)
