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

Read-only salary illustration: domain and real Route Handler transport-fixture tests pass exact calendar estimates, effective salary revisions, mid-month employment, half-day rounding ties, unresolved-input/hold denial, unknown net, company scoping and salary/attendance permission denial. The handler has no business-write RPC or table mutation. It creates no bank/statutory data and leaves normal payroll validation unchanged. Authenticated provider/browser acceptance remains pending.

User-requested sample salaries: sample-salary-setup.sql passes an embedded PostgreSQL fixture with all 40 migrations. Exact monthly gross components total INR 70,000 and INR 80,000; effective dates are September 1 or joining date, whichever is later. Audited RPCs record the assignments; a rerun is rejected without changing history. The script is an operator-run data setup, not an automatic migration or evidence of live application. Bank details and statutory choices remain separate.

Payroll blocker guidance: the actual rendered component is tested for named blocking issues, direct Salary/KYC tab links and omission of passed checks. User-reported September blockers are missing salary coverage, bank details and explicit statutory applicability for both employees. These business inputs have not been invented or changed by tests; actual values remain required.

Daily attendance roster regression: fixture tests confirm eligible employees appear even without a daily record; other-date records, future joiners, exited and inactive employees are excluded. Missing records remain undefined and display Not marked, rather than being treated as absent/present. Mark opens initial entry for the selected employee; Edit retains the recorded-entry correction flow. No live records were changed by these tests.

Attendance CSV date regression: read/import transport fixtures pass ISO and Indian day-first date normalization, impossible-date/leap-day validation, true month mismatch reporting, mixed-format duplicate denial and canonical ISO submission. The importer uses the shared top-bar payroll month. These checks do not import records into the live database.

Attendance-finalization guidance: salary preparation links to monthly attendance review rather than duplicating its finalize button. Known incomplete-attendance errors include at most three example dates and the count of upcoming dates. Real Route Handler/PostgreSQL fixture tests pass, including message length/action guidance, completeness, finalization/reopening, correction, origin/tenant denial and audit. Payroll completeness requirements remain unchanged.

Display-name/sample follow-up: own-name update tests pass for whitespace normalization, rejection of a supplied target user ID and inactive-account denial. The seven-row October CSV parses with the app's CSV parser and passes attendance input validation after mapping its employee-code placeholder to a fixture UUID. It does not test actual live import or complete-month finalization.

Landing-route regression: the real Next proxy sends verified root requests to /dashboard and signed-out requests to /login. A React render fixture verifies the actual client access guard releases verified root/trailing-slash routes, but blocks anonymous, nonmember and unintegrated routes. Production build, TypeScript, lint and local anonymous root/dashboard redirects pass. Authenticated browser acceptance remains pending.

Attendance/salary experience checks: production build, TypeScript and lint pass. All 39 anonymous HTTP checks pass. Read-fixture tests confirm shared payroll views retain captured paise, run versions and payment status without duplicate run reads; attendance preserves employment dates, half days and unresolved punches while reusing the supplied employee list. Authenticated browser/visual acceptance and measured latency remain unverified. The user confirmed the hosted login works after correcting SUPABASE_URL.

Login-entry follow-up: provider/proxy regression checks, TypeScript and lint pass. Local GET /login renders email/password without dashboard navigation; anonymous / and /dashboard redirect to /login. Hosted /api/auth/session returned 503 BACKEND_NOT_CONFIGURED, so production environment setup remains required. Browser visual inspection was unavailable because the browser connection could not initialize.

The user confirmed migrations 001-040 applied live, including upgrade-payroll-finance.sql. This records operator confirmation, rather than independent live database verification. No live financial records were changed by test fixtures. Source changes were pushed to the repository default master branch in commit daac610 for the existing Vercel integration. Vercel deployment status remains unverified. No transfer, statutory filing or automated email occurred.

Embedded PostgreSQL uses fixture Auth helpers and Storage metadata, rather than the actual provider. HTTP smoke checks do not authenticate or perform persistent workflows. Live authenticated journeys, actual Storage, concurrent writes, browser/PDF visual acceptance and backup restoration remain unverified. Outstanding platform scope is recorded in docs/IMPLEMENTATION_PROGRESS.md. These results do not establish production readiness.

## 16 October 2026 client review verification

All 42 migrations and the database workflow suites pass in PGlite. New fixtures calculate across two months with optional setup, test confirmed-email member assignment/admin denial/self-change denial, enforce explicit PF with partially unset other flags, and verify employee-scoped captured warnings. Upgrade packages 041 and 042 preserve locked payroll, published payslips, posted journals/invoices and partial payments exactly.

npm test passes, including the new actual user/payslip handler fixtures, exact comparison threshold/month-boundary/zero/no-baseline cases, saved warning notice rendering, and employee-profile attendance consistency. TypeScript checks pass. The provisional payslip PDF was generated, its notice verified by text extraction, and a rendered page visually inspected with no clipping or overlap. Auth/REST/Storage in these tests are fixtures, and no live account creation, email, salary calculation or payment was executed by tools.

Browser initialization failed in the connected development environment. A signed-in live browser journey, configured SMTP delivery, live Storage acceptance, concurrency and backup restoration remain unverified. Hosted page speed has not been measured; request reduction and code splitting are implementation changes, not measured latency claims.

Final source validation: production build (90 routes/pages), TypeScript, lint with no warnings, and 40 HTTP checks against the local production server passed. The initial HTTP attempt found no running development server; the checks passed after starting the production build on port 3100. No signed-in flow is claimed by these HTTP checks.


Migration 042 SQL Editor fix: the user reported Unexpected statutory validation definition. The migration now matches the statutory branch across LF, CRLF, tabs and indentation instead of relying on an exact newline string. The new test-client-upgrade-format.mjs reproduces stored Windows line endings and verifies the complete upgrade in three formatting variants. The prior failed transaction did not commit migration 042; rerun only the updated upgrade-client-review.sql after 041.

## 18 October 2026 - Client workbook alignment

- Full npm test passed across migrations 001-043 and existing workflow/API/domain suites. After further null-version hardening, the database suite and packaged upgrade preservation test passed again.
- Actual three user-supplied blank XLSX files: exact headers, Excel date cells and empty-data rejection passed. No originals are committed or live records imported.
- Synthetic client tests: employee private fields/counters/mononyms, DA and effective salary, manager resolution, duplicate/invalid batch rollback, monthly code mapping and summaries, optional bank/stat setup, recovery deductions, exact net and balanced journal posting passed. Reviewed client costs do not change salary; stale/null versions and duplicate/partially invalid cost batches are rejected atomically. Invoice/service-charge suggestion arithmetic and saved-payroll mismatch rejection passed.
- TypeScript, lint and production build passed (95 generated routes/pages). Payslip/invoice PDF generation tests passed. Production server on local port 3115 passed 43 anonymous-access/origin/redirect checks including new private exports.
- In-app Browser initialization failed (kernel assets path unavailable); signed-in visual acceptance and live 043 application remain unverified. No actual imports/payments or production salary calculations performed.
- Dependency audit reports eight high findings in existing developer-tool dependency trees; XLSX reader is not listed. No forced major-version downgrade applied.

## 18 October 2026 - Attendance onboarding (044)

Full npm test passes with 44 migrations, including new employee creation from attendance, same-date records for different unknown codes, conflict/missing-name checks and canonical joining dates. Actual Route Handler + PostgreSQL tests verify new attendance onboarding, duplicate/locked-month rollback and unchanged existing employee attendance. HR creation and ordinary-employee denial are covered in database fixtures; no salary or bank data is invented. Packaged upgrades 043/044 preserve protected financial fixtures exactly. TypeScript and lint pass. Production build passes; live SQL application and signed-in visual acceptance remain pending. No live company records changed.

## 18 October 2026 - Salary structure month selection

Client template tests now verify September/October salary changes, stable structure IDs, correct counts, future joiners/revisions, historical exits, carry-forward, leap-month boundaries and neutral display of the known sample name without mutating saved/custom names. The three source workbook header/date checks still pass. No live salary or structure records changed.

## 18 October 2026 - Attendance review cutoff

37 domain checks and payroll-view fixture tests pass. Added explicit October 18 cutoff tests (October 1-17 only), today/future Missing Punch exclusion, previous/future months, joining/exit boundaries, first-of-month and month rollover. Full-month finalization missing-date checks remain unchanged. Service tests verify separate review and full-month completeness values. No live attendance records changed.

## 19 October 2026 - Attendance import validation

Preview and actual Route Handler/PostgreSQL tests cover pre-joining dates, post-exit dates, finalized periods and invalid clock times. The server returns the scoped employee code/date and recorded joining date for known employment-boundary failures, without exposing arbitrary database error text. Existing mixed/new employee imports, atomic rollback and locked/duplicate protections remain covered. New local July/August CSVs each contain 62 test records with dedicated codes and explicit July 1 joining dates; originals are unchanged. Live cause remains unverified without the company's saved employee data.
