# Test results - 14 October 2026

## Passed locally

- All 40 migrations execute in embedded PostgreSQL with fixture Auth and Storage metadata; database workflow suites pass.
- Thirty-six domain checks cover exact payroll, attendance, imports, posted-ledger reports, historical aging, reconciled cash flow, request classification and truthful next-step guidance.
- Payroll regression cases cover exact half-paise ties in calendar/working-day modes, half-up/down rounding, captured source corrections, preserved published originals and rejection of legacy unapproved calculations until recalculated.
- Cash-flow reviews enforce exact signed allocation, version/history immutability, tenant denial and zero-net internal-transfer exclusion. Salary evidence accepts actual within-month dates while rejecting pre-month/future dates.
- Attendance Route Handlers and real tenant/HTTP helpers pass against PostgreSQL RPCs with fixture Auth/REST, including authorization, completeness, atomic audit, quotas and schema fallback.
- Provider error and real Next proxy tests pass: temporary outages are retryable, genuine invalid sessions are denied, abort signals propagate, local logout survives late refreshed cookies, cookie cleanup is project-scoped and transient verification failures do not sign out users.
- One-time SQL packages execute in order. The new 036-040 package preserves existing identities, verified bank details, locked payroll, published payslips, posted invoice/journals and partial payments exactly.
- Payslip/invoice PDF generation, embedded Devanagari font, pagination/wrapping and unsupported-character rejection pass. Both production font traces are present.
- Production build (88 routes/pages), TypeScript, lint and 39 anonymous HTTP/origin/redirect checks pass.

## Live status and limits

Landing-route regression: the real Next proxy sends verified root requests to /dashboard and signed-out requests to /login. A React render fixture verifies the actual client access guard releases verified root/trailing-slash routes, but blocks anonymous, nonmember and unintegrated routes. Production build, TypeScript, lint and local anonymous root/dashboard redirects pass. Authenticated browser acceptance remains pending.

Attendance/salary experience checks: production build, TypeScript and lint pass. All 39 anonymous HTTP checks pass. Read-fixture tests confirm shared payroll views retain captured paise, run versions and payment status without duplicate run reads; attendance preserves employment dates, half days and unresolved punches while reusing the supplied employee list. Authenticated browser/visual acceptance and measured latency remain unverified. The user confirmed the hosted login works after correcting SUPABASE_URL.

Login-entry follow-up: provider/proxy regression checks, TypeScript and lint pass. Local GET /login renders email/password without dashboard navigation; anonymous / and /dashboard redirect to /login. Hosted /api/auth/session returned 503 BACKEND_NOT_CONFIGURED, so production environment setup remains required. Browser visual inspection was unavailable because the browser connection could not initialize.

The user confirmed migrations 001-040 applied live, including upgrade-payroll-finance.sql. This records operator confirmation, rather than independent live database verification. No live financial records were changed by test fixtures. Source changes were pushed to the repository default master branch in commit daac610 for the existing Vercel integration. Vercel deployment status remains unverified. No transfer, statutory filing or automated email occurred.

Embedded PostgreSQL uses fixture Auth helpers and Storage metadata, rather than the actual provider. HTTP smoke checks do not authenticate or perform persistent workflows. Live authenticated journeys, actual Storage, concurrent writes, browser/PDF visual acceptance and backup restoration remain unverified. Outstanding platform scope is recorded in docs/IMPLEMENTATION_PROGRESS.md. These results do not establish production readiness.
