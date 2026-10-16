# Current payroll/finance routes - migrations 036-039

- GET /api/payroll/corrections?month=YYYY-MM-01&employeeId=UUID reads the selected source payroll figures/version. POST requires salary-write and payroll-run permissions and creates a reviewed later-month arrears/recovery linked to a published/posted locked source. Source data is captured by the server.
- GET /api/cash-flow?month=YYYY-MM returns reconciled book cash flow and posted movements. POST saves signed Operating/Investing/Financing allocations with expectedVersion and reviewReference; their total must equal the actual movement. History is retained.
- Reports support receivables-aging and payables-aging with original and reversal posting dates. The report service obtains reviewed cash flow from /api/cash-flow.
- Actual salary payment and failure evidence dates may be within the payroll month or later, but cannot be before the month or in the future. Exports still do not execute transfers.
- Calculation/approval requires the exact-proration migration. Legacy unapproved calculations return PAYROLL_RECALCULATE until recalculated.

# Follow-up routes and behavior - migrations 032-035

- `GET /api/gst/reviews?month=YYYY-MM-01` lists immutable archive metadata; `?id=UUID` retrieves captured content. POST accepts month/reference and captures authoritative server records. Both accounting-write and compliance-write permission are required to capture.
- `GET /api/disbursements/attempts?batchId=UUID` returns scoped evidence. POST records Failed or Retry Prepared with actual date, integer-paise amount, reference/evidence and retryOf for a retry. The RPC rejects duplicate retry, wrong employee/batch and excess outstanding amounts.
- `GET /api/disbursements?month=YYYY-MM-01&export=csv&retryId=UUID` exports the reviewed retry using immutable bank instructions and current outstanding checks. It does not confirm payment.
- Reports support `bank-book`, `cash-book` and `headcount`; the report service formats GST books from `/api/gst`. Financial ledger lists are paginated.
- Tenant business routes use shared read/write/download quotas once migration 034 is applied. HTTP 429 includes Retry-After; no automatic write retry is performed. Direct provider RPC traffic remains subject to RLS/permissions rather than these HTTP counters.

# API reference

GET /api/payroll/illustration?month=YYYY-MM requires payroll.run plus salary.read and attendance.read. It returns a nonpersistent calendar-day, half-up illustration of salary-assignment earnings, including effective salary changes and paid half-days. It does not require bank/statutory setup, infer statutory deductions, include monthly adjustments, or create payroll/payment records. Missing salary/attendance or a salary hold prevents an earnings estimate; final net remains null. Normal calculate/approve/payment endpoints retain their checks.

POST /api/auth/profile accepts only {displayName: string} (1-100 trimmed characters). It verifies the current active account and updates that account's Auth display metadata; no target user ID, company or role is accepted. GET /api/auth/session returns user.displayName from saved display metadata or the user's own profile, with Account as the empty-name fallback. Display names do not authorize access.

JSON success is { data }; errors are { error: { code, message, fields? } }. Business APIs verify active Auth/profile/membership. x-company-id selects a company but does not grant access. Unsafe requests require Origin equal to APP_URL and JSON content type, with a 128 KB body limit. Results are private/no-store. PDF and payment-instruction CSV downloads return authenticated binary/text responses instead of JSON.

## Auth and administration

POST auth/login, auth/logout, auth/reset-password, auth/password; GET auth/session; GET /auth/confirm recovery-token verification. Sessions are HttpOnly cookies. Password changes require at least 12 characters. GET company returns selected company data. GET/POST users require users.manage; listings are paged internally, memberships require confirmed Auth users, self/last-administrator protections apply. GET audit-logs is paginated and requires audit.read. GET/PUT settings and GET/POST statutory-rules require their configured settings/salary permissions.

## Employee and HR

GET/POST employees: paginated RLS-scoped list and versioned writes. Sensitive input requires employees.sensitive in the database. GET employees/detail excludes inaccessible sensitive tables. POST employees/status and employees/exit are explicit lifecycle mutations. employees/import, employees/bulk, employees/kyc and employees/uan-check provide audited imports/bulk edits, manual verification and duplicate checks. No private document upload endpoint is implemented.

GET/POST salary: effective employee assignments with integer-paise components; GET/POST salary-structures: versioned structures; salary/holds: audited holds/releases; salary/import: persistent atomic import batches. Access uses salary.read/write as appropriate.

GET attendance supports month/date/employee filters and pagination. POST attendance accepts rows plus allowUpdate: false for new records (audit reason automatic), true for corrections (nonblank reason required). Duplicate/new-entry conflicts, locked months and employment-date errors are translated explicitly. attendance/imports manages imports. attendance/period GET returns finalization; POST finalizes or reopens with a reason. Incomplete finalization returns ATTENDANCE_INCOMPLETE with actual missing employment dates. GET/POST leave provides types, balances, requests and authorized decisions.

## Payroll and payslips

GET payroll?month=YYYY-MM-01 returns run, finalization and saved snapshots. POST payroll accepts action validate/calculate/approve/lock/unlock and month; transitions require expectedVersion, unlock also reason. Permissions are payroll.run/approve/lock/unlock. GET payslips is RLS-scoped; POST generate/publish requires locked payroll and appropriate run/approval permission. GET payslips/pdf returns a private PDF from captured content.

## Accounting and payments

GET/POST accounts: groups, ledgers, years and balances, with accounting.read/write. GET/POST journals: drafts, posting and reversals. GET/POST payroll-accounting: mappings, locked runs and unique accrual posting.

GET/POST parties: Customer/Vendor records and versioned edits. GET/POST invoices: paged items/payment evidence; actions create/edit draft, post, cancel or record actual payment. GET/POST banking: company accounts, masked identifiers, ledger balances/movements and payment corrections. All use accounting permissions.

GET disbursements?month=YYYY-MM-01 returns masked prepared instructions; export=csv returns private outstanding bank instructions. Both require disbursements.write. POST actions prepare, record and cancel. Recording salary evidence also requires accounting.write at the database layer. Export does not mark paid. Migrations 019?020 are required for these new financial workflows.

## Dashboard and reports

GET dashboard composes only data visible to the caller. Unknown/configuration-dependent amounts remain null. GET reports?month=YYYY-MM&kind=... supports trial-balance, profit-loss, balance-sheet, ledger-book and payroll-accounting with accounting.read; payroll-register, salary-cost, pf-summary, esi-summary, pt-summary and tds-summary with payroll.run. Contribution summaries are review data, not government filing files.

Strict request schemas live alongside each Route Handler. Schema validation returns field paths/messages. Known business failures are sanitized and translated; arbitrary database error text is not exposed. Missing required schema returns 503/MIGRATION_REQUIRED. No automatic bank, statutory submission, email delivery, custom role CRUD or private storage endpoint is claimed.
# Additional authenticated routes - migrations 021-031

All routes use the verified session and `x-company-id`; mutations also check origin and strict input. RLS and transactional RPC permissions remain the final authority.

| Route | Operations |
| --- | --- |
| `/api/employees/documents` | Scoped list/download; bounded multipart actual-file upload; versioned review/remove |
| `/api/employees/personal` | Versioned personal profile editing |
| `/api/employees/manager` | Versioned reporting manager assignment; cycles denied |
| `/api/employees/account` | Admin-only current link and versioned confirmed-member link/unlink with reason |
| `/api/announcements` | Persisted announcements and reviewed publish/archive changes |
| `/api/support` | Own/admin tickets, replies and status transitions |
| `/api/notifications` | Own unread inbox and idempotent read acknowledgement |
| `/api/compliance` | Reviewed obligations and actual filing evidence; no provider submission |
| `/api/gst` | Dated invoice/note/reversal books and latest reviewed purchase credit eligibility |
| `/api/attendance/calendar` | Reviewed schedules/holidays, retirement and filling missing nonworking dates |
| `/api/payroll/adjustments` | Reviewed monthly earning/recovery adjustments and audited cancellation |
| `/api/banking/reconciliation` | Reviewed statement import, matching/unmatching and completion/reopening |
| `/api/invoices/pdf` | Protected PDF of captured invoice data with audited download |
| `/api/invoices/notes` | Posted credit/debit notes and audited source reversal |

Accounts and journals also support versioned draft correction and accounting period/year controls. Company/settings edits require their expected version. File, payslip and payment-instruction downloads are audited. Invoice-note amounts are reviewed integer paise; posting creates balanced journals and changes the outstanding balance without altering original invoice totals. Refunds and statutory note submission are not executed.


Provider transport failures return HTTP 503 (AUTH_UNAVAILABLE or DATABASE_UNAVAILABLE), rather than a credential error. An unconfirmed write must be checked by refreshing records before retrying. Session/membership checks use migration 040 RPCs, with the earlier verified fallback when absent. Logout always clears this project locally; remoteRevocationConfirmed reports whether provider revocation succeeded.

## Client review changes (041-042)

- Migration 041 permits missing bank/statutory applicability setup during calculation and returns warnings. Explicitly applicable deductions still need reviewed rules; 042 checks these even with other unset flags. Warnings are captured with salary snapshots. Published/locked history is not rewritten.
- GET /api/users requires users.manage and, with 042, returns only the selected company's members with user_id, display_name, email, role, active and created_at. Earlier schema listing retains the existing limited fallback.
- POST /api/users accepts exactly one of userId (UUID) or email (confirmed account), plus role and active. The database resolves the confirmed email, enforces users.manage and forbids self access changes. Unknown/unconfirmed email returns ACCOUNT_NOT_READY. This assigns membership; it does not create an Auth account or send an invitation.
- GET /api/payslips and /api/payslips/pdf filter captured setup warnings to the payslip's employee. RLS remains responsible for underlying payslip access. Future 042 calculations capture only that employee's warning list.
- Previous-month comparison is a read of saved payroll via GET /api/payroll; it has no financial mutation or anomaly-based automatic adjustment.
