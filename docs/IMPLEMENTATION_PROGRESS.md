# Implementation progress - 14 October 2026

The core payroll and accounting workflows are implemented and tested locally. The full requested platform is not yet complete or verified for production.

## Existing Supabase project

SVS Corporate Services is already bootstrapped. The user confirmed successful application of migrations 001-020. Do not rerun setup.sql, upgrade.sql, upgrade-next.sql or bootstrap_company.

The additive **supabase/upgrade-remaining.sql** now contains migrations **021-031**. The user confirmed successful application on 14 October 2026. Do not rerun this package. The package preserves existing company, membership, employee and verified bank records in the local upgrade fixture. The publishable key cannot apply schema changes. Missing schema produces MIGRATION_REQUIRED; future additive upgrades will be prepared separately.

Source changes have been pushed to the connected Vercel repository, and the user confirmed hosted login works. No bank transfer or statutory filing has been performed by tools. Anonymous REST probes deny table access; authenticated live workflows remain unverified by tools.

## Implemented foundation

- Verified tenant membership, role permissions, restrictive RLS, transactional audit, origin checks, private responses and provider error handling.
- Employee directory, sensitive identity editing, optimistic versions, lifecycle/exit records, imports and bulk actions. Bank identifiers and PAN changes reset verification.
- Salary structures, effective revisions, holds and imports; exact integer-paise input.
- Attendance entry/corrections, atomic date ranges/imports, missing-date diagnosis, finalization/reopening and leave approvals/balances. Initial entry receives an audit reason; corrections require an explicit reason.
- Reviewed configurable contributions, server calculation, effective salary segmentation, calendar proration, immutable snapshots, stale-input rejection, approval and locking.
- Locked-run payslip generation/publication and protected PDFs from captured financial data.
- Ledgers, financial years, balanced journal posting/reversal, payroll mappings/accrual and posted-ledger reports.
- Customer/vendor records, versioned invoice drafts, captured parties, reviewed tax amounts, posting, payment evidence and book corrections.
- Ledger-derived bank/cash balances and immutable verified salary instructions. Export does not mark salaries paid. Confirmed evidence supports partial payments, balanced journals and corrections.

## New local implementation - migrations 021-031

- Private employee document storage reservations, file signature/size/hash checks, employee/HR access policies, verification/rejection/removal history and bounded actual-file uploads. Storage behavior is tested with metadata fixtures, not the live provider.
- Personal-profile editing, company details/settings with versions, manager assignment with cycle prevention and privileged employee-login linking/unlinking with reasons.
- Persisted announcements, support tickets/replies, own-user notifications and reviewed compliance filing evidence. No simulated messages, filing or external delivery.
- GST book summaries and explicitly reviewed purchase-credit eligibility; accountant review is required.
- Reviewed effective work schedules, holiday/weekly-off filling for missing employment dates and captured shift start times. Existing attendance is not overwritten.
- Reviewed monthly overtime, arrears, reimbursements, bonus and recovery adjustments captured in immutable payroll snapshots; configurable half-up/down rounding.
- Payroll workflow indicators read actual publication, accrual and recorded payment state.
- Versioned journal draft edits/cancellation, monthly accounting closure/reopening and financial-year status controls.
- Immutable reviewed bank statement imports, exact signed balances, matching/unmatching, duplicate-clearing protection, reconciliation/reopening and detection of subsequent book changes.
- Reviewed credit/debit notes, adjusted outstanding balances, balanced source journals, dependent-note and overpayment guards, and audited source reversals.
- Invoice PDF generation with captured company identity, wrapping/pagination and download audit. Protected employee files, payslips and salary-instruction exports also record downloads.
- Company/month page isolation prevents stale views carrying across tenant or period switches.

Existing page layouts are retained. Unsupported individual operations remain disabled or explicitly unconfigured.

## Follow-up local implementation - migrations 032-035

The applied 021-031 package is frozen. The new additive package is **supabase/upgrade-followup.sql**, which the user confirmed applied on 14 October 2026. Do not rerun this package.

- Cash Book and Bank Book now show actual opening balances, posted movements and closing balances; GST and historical employment headcount reports are enabled.
- Immutable GST book review captures preserve authoritative posted invoice/note/reversal events and the eligibility review at capture time. Credit-review versions are retained from this upgrade onward; the initial backfill records the existing latest review rather than inventing older versions.
- Actual failed-payment evidence and reviewed retry preparation are immutable, scoped to the captured batch/employee and capped by outstanding salary. They do not post journals or mark salaries paid. Retry CSV exports use verified captured bank details and a stable retry instruction ID.
- Distributed per-user HTTP request quotas use atomic database counters: 240 reads, 60 writes and 30 private downloads per minute across company memberships. Rejections return HTTP 429 and Retry-After. Limits activate with migration 034; older schema compatibility allows existing workflows until it is applied. Direct Supabase RPC traffic and provider Auth limits remain separate.
- Financial-year closure also rejects draft invoices and incomplete payroll/accruals.
- Reviewed working-day proration uses full-month schedules and explicit holidays, employment dates, effective salary segments and weighted half days. It captures the calendar basis and invalidates approval after calendar changes. Calendar and half-up/down modes remain supported.
- The Documents tab uses server-authorized own/HR read capability. Linking an employee login now provides access to that employee's permitted files through the UI.

## Current payroll/finance implementation - migrations 036-040

The user confirmed migrations 001-040 applied successfully, including supabase/upgrade-payroll-finance.sql (036-040). All applied packages are frozen; do not rerun them. Source changes were pushed to the repository default master branch in commit daac610. Vercel deployment and live authenticated verification remain pending.

- Reviewed prior-payroll corrections capture the protected source run/version and financial figures, then apply arrears/recovery in a later eligible payroll month. Published source payroll, payslips, journals and payments are retained. Exited employees still require a separate settlement workflow.
- Receivables/payables aging reconstructs month-end balances from original posted invoices, notes, receipts/payments and each dated reversal. Current cancellation status does not erase prior-period balances; credit balances remain visible.
- Reviewed cash flow reconciles opening balances, posted movements and closing balances. Operating/investing/financing allocations must equal the posted movement. Unreviewed or changed classifications remain explicit; versioned review history is immutable. Zero-net internal bank/cash transfers are excluded.
- Actual confirmed salary transfers and failed-attempt evidence may be dated within the payroll month, including before a weekend/holiday month end. Dates before the payroll month and future dates remain invalid; snapshot, verification, outstanding and source-journal controls remain enforced.
- An exact-half test exposed a one-paise error caused by dividing daily salary before summation. Migration 039 sums integer/half-day weighted amounts before dividing and rounding once, for both calendar and working-day modes. Half-up/down regression cases pass. Calculation-method provenance blocks approval of legacy unapproved calculations until recalculated.
- Application calculation/approval requires migration 039 so the known older rounding method is not used through the app. Published/locked originals are not rewritten.

## Attendance and salary experience update

Implemented the research-led monthly workflow described in [payroll experience research](PAYROLL_EXPERIENCE_RESEARCH.md). Payroll Home shows saved monthly totals and the next action. Attendance opens on monthly review, highlights incomplete registers and provides an employee date editor using audited entry/correction. Salary review has a compact default table, explicit calculation and review/lock guidance; adjustments mount on demand. Salary Payments provides the confirmed payroll-entry step in place and shows recorded paid/remaining amounts. Attendance, salaries, payments and payslips share the top-bar month. Other menu groups collapse until needed.

Salary loading now reuses one payroll response and the selected employee's captured calculation; monthly attendance reuses the loaded employee list. No database migration or live financial mutation is required. Build, TypeScript, lint, 36 domain checks, payroll/attendance view fixtures and 39 anonymous HTTP checks pass. These checks do not establish authenticated browser acceptance or a measured latency improvement. The user confirmed hosted login works after correcting the Supabase URL.

## Outstanding implementation and acceptance

Testing preview is implemented without schema changes: Calculate Salaries offers Preview without bank / statutory setup. It shows salary-assignment amounts and a calendar-day, half-up base-earnings estimate from complete saved attendance. It excludes deductions, employer contributions and monthly adjustments, leaves final net unknown, and refuses to estimate missing salary/attendance or held salary. It is read-only and cannot approve, post, publish or pay. It does not replace the authoritative payroll calculation.

- Legal statutory filing formats and submission integrations. Archived GST book reviews are review records; they are not submitted returns.
- Annual TDS/slabs, complete state PT/LWF models, custom components, full-and-final settlement and corrections for exited employees.
- Provider execution and live acceptance of the new correction, aging and reviewed cash-flow workflows. No transfer is executed by the manual evidence/export workflows.
- Automated email, banking-provider execution, government filing and billing integrations require configured external services. Manual instructions/evidence are supported; they are not provider execution.
- Live authenticated verification, actual Storage upload/download/cleanup, concurrency, browser/PDF visual acceptance and backup restoration. No usable in-app browser was connected for this pass.

## Current verification

All 40 individual migrations and the database workflow suites pass in embedded PostgreSQL with fixture Auth/Storage. The follow-up package preserves identities, verified bank details, locked payroll, published payslips, posted invoice/journal and partial payment fixtures exactly. Thirty-six domain checks and the real tenant/HTTP rate-limit integration test pass. Production build (88 routes/pages), TypeScript, lint, bundled PDF traces and all 39 anonymous HTTP/origin/redirect checks pass. Provider outage, cancellation, scoped local sign-out and real Next proxy fixture checks pass. Live authenticated verification remains pending.

See [test results](../TEST_RESULTS.md), [deployment instructions](DEPLOYMENT_GUIDE.md) and [payroll workflow](PAYROLL_WORKFLOW.md). Local fixture results do not establish production readiness.

Migration 040 combines active-profile, membership, permission and request-quota checks into one authorized database call and supplies verified session context. Earlier schemas retain the existing authorization fallback. Provider outages return retryable errors instead of invalid credentials; requests are bounded and notification refreshes cannot overlap. Project-scoped local sign-out blocks late refreshed cookies even when remote revocation is unavailable.

## 16 October 2026 - Optional setup for salary calculation
- Migration 041 makes missing bank details and unknown statutory applicability warnings rather than calculation blockers. Employee setup fields remain unchanged; no applicability flags or bank data are invented.
- Existing configured statutory deductions, attendance/salary coverage, permissions, input freshness and payment bank verification remain enforced. Unconfigured statutory deductions are excluded, and displayed net pay is provisional until reviewed.
- Validation warnings are captured in each salary snapshot. Shared month selectors show newest first.
- Apply supabase/upgrade-optional-payroll-setup.sql once after migrations 001-040. Live application is pending user SQL Editor execution.
- Database fixture verifies exact INR 70,000 calculation in September and October with no bank/statutory records, two warnings and persisted warning snapshots. Existing database regression suite passed.

## 16 October 2026 - Client review update (042)
The user confirmed migration 041 applied successfully. Do not rerun upgrade-optional-payroll-setup.sql.

Migration 042 is prepared as supabase/upgrade-client-review.sql and has not been applied to the live project by tools. It scopes future snapshot warnings per employee, validates explicitly applicable deductions even with other unset flags, and adds authorized named member listing/email assignment. Existing locked payroll, published payslips and payment records are preserved in the upgrade fixture.

Employee-profile attendance now reads saved rows and derives its summary from the same response. Daily attendance removes duplicate reads, guards late date-switch responses and exposes retry on load failure. Salary actions refresh once; independent server reads run concurrently, advanced panels load on demand, and salary structures reuse revision data instead of per-employee salary calls. Live components no longer initialize the seeded operations store for reference options.

Saved provisional-pay notices appear after reopening Payroll Home, salary review, breakdowns and payslips/PDFs. An optional previous-month comparison flags large changes for review. Company administrators assign confirmed accounts by email; account creation/invitation still uses Supabase Authentication, and client email delivery needs configured SMTP.

The generated provisional payslip was rendered and visually inspected locally. In-app browser initialization failed, so signed-in browser acceptance remains unverified. See CLIENT_HANDOVER.md and the dated research appendix for setup, sources and remaining provider/statutory scope. Earlier status entries describe their respective implementation dates, not current deployment proof.


Migration 042 SQL Editor fix: the user reported Unexpected statutory validation definition. The migration now matches the statutory branch across LF, CRLF, tabs and indentation instead of relying on an exact newline string. The new test-client-upgrade-format.mjs reproduces stored Windows line endings and verifies the complete upgrade in three formatting variants. The prior failed transaction did not commit migration 042; rerun only the updated upgrade-client-review.sql after 041.

## 18 October 2026 - Client workbook alignment (043)

The user confirmed 042 applied. Client Employee Database, monthly Attendance and Salary Structure workbooks are aligned through XLSX/CSV imports, counter/private fields, DA and client-format exports. L defaults to paid leave; H to holiday including Sundays/weekly offs, per the user. Reviewed client costs and invoice suggestions remain separate from employee payroll and posted accounting. See [template alignment](CLIENT_TEMPLATE_ALIGNMENT.md) for mappings, limits, setup and unresolved source conventions. Apply only supabase/upgrade-client-templates.sql after 042; live application is pending. Original workbooks contain no employee rows and were not imported into the live company.
