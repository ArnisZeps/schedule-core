# Tasks: fix-logout-crash

<!-- Never delete tasks. Mark done, append new ones. -->

## 2026-05-14 Fix

- [x] Write RTL test: logout from a dashboard page navigates to /login without throwing
- [x] Write RTL test: rendering the dashboard layout with null user redirects to /login and renders nothing
- [x] Present failing tests for approval
- [x] Fix `apps/web/app/(dashboard)/layout.tsx` — replace one-shot `authenticated` local state with `useAuth().user` reactive guard (see design.md)
- [x] Verify with Playwright MCP: click logout in the running app, confirm no console error and redirect to /login
- [x] Update `docs/domains/auth.md` — Frontend > Routes section to reflect the new layout guard behaviour
