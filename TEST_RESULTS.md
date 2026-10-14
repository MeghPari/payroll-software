# Test results - 14 October 2026

## Passed locally

- All 40 migrations execute in embedded PostgreSQL with fixture Auth and Storage metadata; database workflow suites pass.
- Thirty-three domain checks cover exact payroll, attendance, imports, posted-ledger reports, historical aging, reconciled cash flow and request classification.
- Payroll regression cases cover exact half-paise ties in calendar/working-day modes, half-up/down rounding, captured source corrections, preserved published originals and rejection of legacy unapproved calculations until recalculated.
- Cash-flow reviews enforce exact signed allocation, version/history immutability, tenant denial and zero-net internal-transfer exclusion. Salary evidence accepts actual within-month dates while rejecting pre-month/future dates.
- Attendance Route Handlers and real tenant/HTTP helpers pass against PostgreSQL RPCs with fixture Auth/REST, including authorization, completeness, atomic audit, quotas and schema fallback.
- Provider error and real Next proxy tests pass: temporary outages are retryable, genuine invalid sessions are denied, abort signals propagate, local logout survives late refreshed cookies, cookie cleanup is project-scoped and transient verification failures do not sign out users.
- One-time SQL packages execute in order. The new 036-040 package preserves existing identities, verified bank details, locked payroll, published payslips, posted invoice/journals and partial payments exactly.
- Payslip/invoice PDF generation, embedded Devanagari font, pagination/wrapping and unsupported-character rejection pass. Both production font traces are present.
- Production build (88 routes/pages), TypeScript, lint and 39 anonymous HTTP/origin/redirect checks pass.

## Live status and limits

The user confirmed migrations 001-040 applied live, including upgrade-payroll-finance.sql. This records operator confirmation, rather than independent live database verification. No live financial records were changed by test fixtures. Source changes were pushed to the repository default master branch in commit daac610 for the existing Vercel integration. Vercel deployment status remains unverified. No transfer, statutory filing or automated email occurred.

Embedded PostgreSQL uses fixture Auth helpers and Storage metadata, rather than the actual provider. HTTP smoke checks do not authenticate or perform persistent workflows. Live authenticated journeys, actual Storage, concurrent writes, browser/PDF visual acceptance and backup restoration remain unverified. Outstanding platform scope is recorded in docs/IMPLEMENTATION_PROGRESS.md. These results do not establish production readiness.
