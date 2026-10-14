# PayFlow backend audit — reviewed 9 October 2026

## Architecture

Next.js 16.3.5 App Router / React 19.2.8 / TypeScript strict / Tailwind 4 / Base UI, React Hook Form, Zod 3, Zustand 5. There are 145 source files at baseline. No Route Handlers, database, authentication, persistent business storage, background workers, or automated tests exist. `README.md`, both agent instruction files, package/deployment configuration, types, services, stores, page imports and action handlers were inspected. The installed Next.js Route Handler, cookies and authentication guides govern this implementation.

There are two independent data paths: original mock arrays through Promise-based services, and a newer mutable `operations-store.ts` with employee/KYC/salary/attendance/payroll state. Neither persists across server processes or browser reloads. UI selection lives separately in `app-store.ts`. Existing types express money as JavaScript numbers in rupees; persisted financial data must use integer paise with explicit presentation adapters.

## Module inventory and gaps

| Routes | Existing behavior | Backend gap |
| --- | --- | --- |
| dashboard | hardcoded KPIs/charts plus store readiness calculations | transactional queries and aggregation |
| employees, employees/[id] | directory/filter/page/drawer/add form; profile tabs: Overview, Employment, Salary, Attendance, KYC, Documents, Payroll History | persistent CRUD, lifecycle history, scoped sensitive fields, uploads; add form invents DOB/gender/CTC |
| salary-structures | structure editing, actual salaries, upload, revision list | immutable effective-dated assignments and validated component rules; Save reports success without saving |
| attendance | Today, Register, Leave Requests/Balances, Upload/History; CSV parsing and in-memory finalization | period locking, real import validation, transactional leave balances and approvals |
| payroll | stepper/finalize/validate/review/approve/lock/unlock | trusted calculations, state machine, concurrency/idempotency, snapshots |
| payslips | mocked publish/reprocess/download/notify | finalized snapshot PDF/private storage and employee ownership |
| disbursement | delayed simulated success | payment records, bank exports, verified/manual confirmation with evidence |
| compliance, gst | sample obligations/filing statuses | effective-dated reviewed rules, filing evidence; no government integration |
| payroll-reports, financial-reports | report cards and simulated generation | posted-source reports, period filters, exports |
| accounting, chart-of-accounts, ledgers, journal-entries, payroll-accounting | sample accounts/vouchers/journals, placeholder creation | balanced atomic posting/reversal, locked fiscal periods, account mappings |
| customers, vendors, sales-invoices, purchase-invoices | sample parties/invoices and placeholder actions | server tax calculations, invoices/items, allocations, numbering |
| banking | sample balances/transactions | bank feeds/imports/reconciliation; no bank provider |
| settings | store-only statutory/proration saves; fake company save, billing | real tenant settings; billing must remain unavailable |
| announcements, support | hardcoded announcements, placeholder creation, false ticket success | scoped persistence and real delivery expectations |
| user-roles | hardcoded users/roles, demo role switch, permission matrix | authenticated memberships and server/DB RBAC; no role self-escalation |
| audit-trail | browser store audit events | immutable DB audit in same transaction as changes |

## Mock inventory

All 11 files under `src/data/mock`: accounting, attendance, chartOfAccounts, dashboard, employees, financialReports, leaves, payroll, payslips, salaryStructures. Original accounting/dashboard/report/payslip services return arrays. Employee/salary/KYC/statutory/audit services use Zustand. Attendance/payroll mix both. Direct mock imports also exist in pages/components, contrary to the README's blanket service-only claim. `operations-store.ts` seeds 28 employees, salary profiles, KYC, daily attendance and a salary hold, assumes Super Admin, performs floating-point statutory calculations, and attributes audit to client-selected roles. The generic upload component simulates spreadsheet contents. Company/month selectors and notifications contain demo data. There is no existing localStorage persistence; browser memory is the primary problem.

The complete source-level action/dependency inventory is in `docs/UI_ACTION_INVENTORY.md`, generated before implementation. It records every source line containing click/submit handlers, demo feedback, mock imports, state accesses and simulated latency, including shared dialogs.

## Entities and endpoints

Foundation: companies/settings, profiles, roles/permissions/assignments, audit. HR: employees, departments/designations, reporting relationships, sensitive bank/statutory rows, employment/status history and private documents. Salary: structures/components, effective-dated assignments/values/revisions/rules. Attendance: records/periods/import batches/rows, holidays/schedules, leave types/policies/balances/requests/approvals. Payroll: periods/runs/employee snapshots/components/validation/approvals/adjustments/locks, payslips, disbursements/items. Accounting: fiscal periods, account groups/accounts, immutable posted journals/lines, parties, invoice headers/items/notes/allocations, bank records/reconciliations, GST and payroll mappings. Administration: announcements/support/compliance/report/export jobs. Every dependent FK needs a company-qualified key.

REST endpoints will be grouped under `/api/auth`, `/api/company`, `/api/users`, `/api/roles`, `/api/employees`, `/api/salary-structures`, `/api/attendance`, `/api/leave`, `/api/payroll`, `/api/payslips`, `/api/disbursements`, `/api/accounting`, `/api/invoices`, `/api/compliance`, `/api/reports`, `/api/audit-logs`. Exact implemented contracts belong in API_REFERENCE.md; proposed endpoints are not implementation claims.

## Security and integration risks

No server access control exists. All pages can currently render sensitive demo records. Financial actions falsely succeed; service changes alone cannot fix direct store calculations. Employees include full identifiers/bank details. Demo-role switching is unsuitable for authentication. No audit atomicity, tenant enforcement, immutable payroll, duplicate request protection or private file storage exists. Browser caches must clear on company/session changes; server permissions must be checked independently on every request. Direct Supabase access must obey RLS, including RPC execution grants. Finance access must not imply unrestricted HR identity access.

## Dependencies and implementation order

Keep Zod/forms/UI; Supabase SSR/client and server-only dependencies exist in the uncommitted foundation. Use a dependency-free Node/TypeScript test runner initially. Prefer PostgreSQL transactions/RPCs over adding an ORM. No service-role key is needed in normal request processing. No Supabase project choice or credentials have been supplied and no migrations have been applied. Existing `.env.local` has a Vercel token only (value not printed or copied). Live deployment could not be fetched by web tool.

1. Foundation migration: company isolation, permissions, server sessions, safe operator bootstrap, API errors, DB audit; fail closed on missing configuration.
2. HR tables/APIs and wire existing employee UI; no fabricated defaults, no hard delete.
3. Salary, attendance and leave transactions with period locks and revision history.
4. Exact-money payroll engine, reviewed rules, snapshots and explicit approval/lock workflow.
5. Private payslip documents and evidence-based disbursement/compliance.
6. Balanced accounting, invoice allocations and payroll posting.
7. Live reporting/settings/roles/administration.
8. Remove remaining demo paths, verify full cross-role/cross-company integration and production build.

## Current implementation update
The supplied empty Supabase project URL/publishable key are configured locally and Auth connectivity returned HTTP 200. Foundation auth/admin/employee endpoints and a server session/navigation guard are implemented; both migrations passed embedded PostgreSQL tests. Final Next.js 16.4.0 build passed, including TypeScript and production HTTP access-control smoke checks. Supabase schema application and authenticated live tests remain pending. Full HR/payroll/accounting/compliance integration remains unfinished. See IMPLEMENTATION_PROGRESS.md for precise scope.

Do not expose unfinished modules as live operations. Gate them explicitly until integrated, preserving original page/component code for subsequent integration. This temporary limitation is not final acceptance. Legal rates require business/accountant review; this implementation must not invent universal statutory defaults. No production deploy, real transfer or destructive production migration is authorized.
