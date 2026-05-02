# Testing

## Philosophy
TDD is mandatory. Tests are written before implementation.
Red → Green → Refactor. No exceptions.

## Backend
- Framework: Vitest (`apps/api` and `packages/db`)
- Every endpoint has integration tests; every business logic function has unit tests
- Run: `pnpm test` | Run single: `pnpm test -- src/lib/jwt`

### Workflow
1. Write failing tests that describe expected behavior
2. Present tests to user for approval
3. Only after approval — implement until tests pass
4. Refactor if needed; tests must stay green

## Frontend
- Framework: Vitest + React Testing Library + MSW (`apps/web`)
- No real browser, no Puppeteer — jsdom + network interception only
- API calls intercepted by MSW handlers; no dev server or API server required
- Run: `pnpm --filter web test`
- Each test file maps to one user flow (e.g. `login.test.tsx`)

### Workflow
1. Write failing RTL tests describing expected UI behavior (what the user sees)
2. Run them — they must fail (red)
3. Present failing test output to user
4. Implement UI until tests pass (green)
5. Never fake assertions to force green

## Agent UI Verification (Playwright MCP)

RTL tests verify logic in jsdom. Playwright MCP is used by the agent to verify the real rendered UI in a browser — not a test framework, not committed test files. It closes the implementation feedback loop.

### When to use
After RTL tests pass and implementation is done, before marking any UI task complete.

### Workflow
1. Ensure dev server is running (`pnpm --filter web dev`)
2. Use `mcp__playwright__browser_navigate` to open the feature URL
3. Use `mcp__playwright__browser_take_screenshot` to visually verify layout and content
4. Use `mcp__playwright__browser_click` / `browser_fill_form` / `browser_type` to test the golden-path interaction
5. Use `mcp__playwright__browser_console_messages` to check for JS errors
6. If anything looks wrong — fix it, re-verify. Do not mark done until the browser confirms correct behavior.

### Rules
- Always verify in the browser after RTL passes — never skip this step for UI tasks
- Screenshot before and after interactions to catch regressions
- Fix issues found during verification before marking the task complete
- Do not use Playwright MCP as a substitute for RTL tests — both are required

## Rules
- Never skip writing tests first
- Never mark a task complete if tests are failing
- If a test is hard to write, the design is wrong — simplify first
- No internal React state assertions — only what's visible in the rendered output
- Test user-visible behavior: rendered text, form submission, navigation, error messages
- MSW handlers must reflect the actual M4 API contract — no invented response shapes
