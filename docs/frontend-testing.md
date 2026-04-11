# Frontend Testing

## Approach
Puppeteer via CLI. No jest-dom, no React Testing Library.
Real browser, real interactions, real assertions.

## Setup
Puppeteer runs locally against dev server.
Dev server must be running before tests execute.
Start dev server: `npm run dev`
Run frontend tests: `npm run test:e2e`

## Workflow per task
1. Write Puppeteer script describing expected UI behavior
2. Run it — it must fail (red)
3. Present failing test output to user
4. Implement UI until test passes (green)
5. Never fake assertions to force green

## Test structure
Each test file maps to one user flow:
- booking-flow.test.js
- onboarding-flow.test.js
- dashboard-flow.test.js

## Rules
- Tests interact with UI exactly as a real user would
- No internal React state assertions — only what's visible in browser
- If Puppeteer can't reach something, the UI is broken — fix the UI
- Screenshots on failure are mandatory for debugging