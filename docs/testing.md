# Testing

## Philosophy
TDD is mandatory. Tests are written before implementation.
Red → Green → Refactor. No exceptions.

## Backend
- Framework: Jest
- Every endpoint has integration tests
- Every business logic function has unit tests
- Run: `npm run test`
- Run single: `npm run test -- --testPathPattern=filename`

## Workflow per task
1. Write failing tests that describe expected behavior
2. Present tests to user for approval
3. Only after approval — implement until tests pass
4. Refactor if needed, tests must stay green

## Rules
- Never skip writing tests first
- Never mark a task complete if tests are failing
- If a test is hard to write, the design is wrong — simplify first