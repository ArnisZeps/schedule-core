# Testing

## Philosophy
TDD is mandatory. Tests are written before implementation.
Red → Green → Refactor. No exceptions.

## Backend
- Framework: Vitest (both `apps/api` and `packages/db`)
- Every endpoint has integration tests
- Every business logic function has unit tests
- Run: `pnpm test`
- Run single: `pnpm test -- src/lib/jwt`

## Frontend
- Framework: Puppeteer via CLI. No jest-dom, no React Testing Library.
- Real browser, real interactions, real assertions.
- Dev server must be running before tests execute.
- Start dev server: `npm run dev`
- Run: `npm run test:e2e`

### Test file structure
Each file maps to one user flow:
- booking-flow.test.js
- onboarding-flow.test.js
- dashboard-flow.test.js

## Workflow per task

### Backend
1. Write failing tests that describe expected behavior
2. Present tests to user for approval
3. Only after approval — implement until tests pass
4. Refactor if needed, tests must stay green

### Frontend
1. Write Puppeteer script describing expected UI behavior
2. Run it — it must fail (red)
3. Present failing test output to user
4. Implement UI until test passes (green)
5. Never fake assertions to force green

## Rules
- Never skip writing tests first
- Never mark a task complete if tests are failing
- If a test is hard to write, the design is wrong — simplify first
- Frontend tests interact with UI exactly as a real user would
- No internal React state assertions — only what's visible in browser
- If Puppeteer can't reach something, the UI is broken — fix the UI
- Screenshots on failure are mandatory for debugging
