# PayFlow — Payroll, HR & Accounting Platform (Frontend)

A production-quality frontend for a payroll, HR, attendance, and accounting SaaS
platform, built with Next.js App Router, TypeScript, and Tailwind CSS. This is a
**frontend-only** build: every screen is fully interactive against a realistic
mock-data layer, structured so a backend can be dropped in later without
touching the UI.

## Tech stack

- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript
- Tailwind CSS v4
- shadcn/ui (built on Base UI primitives — see note below)
- Recharts for charts
- React Hook Form + Zod for form validation
- Zustand for lightweight global UI state (selected company/month, sidebar)
- date-fns for date formatting
- Sonner for toast notifications

> **Note on shadcn/ui:** the installed component set is generated against
> [Base UI](https://base-ui.com) rather than Radix. Triggers use a `render`
> prop instead of `asChild`, and some components (`Select`, `Tabs`) report
> `string | null` from their change handlers. This is already accounted for
> throughout the codebase.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/dashboard`.

```bash
npm run build   # production build + typecheck
npm run start   # run the production build
npm run lint    # ESLint
```

## Project structure

```
src/
  app/                    Next.js App Router routes (one folder per route, see below)
  components/
    layout/               AppShell, AppSidebar, TopHeader
    shared/                Reusable UI: StatCard, DataTable, StatusBadge, ChartCard,
                           AlertCard, PayrollStepper, AccountTree, BulkUploadDialog,
                           SalaryCalculationDrawer, StateDistributionCard, charts/, etc.
    employees/             Detail drawer, add-employee form, change-status/salary-hold
                           dialogs, bulk-upload wrapper
    attendance/             Mark/edit attendance dialog, bulk-upload wrapper
    salary/                 Bulk salary upload wrapper
    ui/                    shadcn/ui primitives (button, dialog, table, ...)
  config/
    api.ts                 API base URL / timeout config for future backend wiring
    nav.ts                  Sidebar navigation structure
    permissions.ts           Centralized role → module permission map (section 25 prep)
  data/mock/               Phase 1 seed data (accounting, invoices, reports, ...)
  services/                 Promise-based data-access functions (see below)
  store/
    app-store.ts             Company/month selection, sidebar state
    operations-store.ts       Employee/KYC/salary/attendance/payroll engine — see below
  types/                    Shared TypeScript interfaces and unions (operations.ts holds
                           the payroll-engine types)
  utils/                    formatINR, pluralize, initials, etc.
  lib/                      cn() className helper, mockDelay(), csv.ts (template/parse)
```

## Routes

| Route | Purpose |
|---|---|
| `/dashboard` | KPI overview, Today's Workforce, Payroll Exceptions, Payroll Readiness, charts |
| `/employees` | Directory, State/Location/Status filters, bulk upload, bulk actions, distribution-by-state |
| `/employees/[id]` | Employee profile: Overview, Employment, Salary, Attendance, KYC & Statutory, Documents, Payroll History |
| `/salary-structures` | Structure rules + per-employee actual salary, bulk salary upload, revision history |
| `/attendance` | Today's Attendance, monthly Attendance Register (with finalize/lock), leave requests/balance, bulk upload, upload history |
| `/payroll` | 11-step payroll run: attendance finalization → validation → review → approve → lock |
| `/payslips` | Payslip list, status donut, bulk publish/download/reprocess actions |
| `/disbursement` | Salary disbursement status per employee |
| `/compliance` | Statutory filing checklist + payroll alerts |
| `/payroll-reports` | Payroll-specific report library (PF, ESI, TDS, F&F, ...) |
| `/audit-trail` | Searchable log of employee/salary/attendance/payroll changes |
| `/accounting` | Accounting dashboard: revenue/expense KPIs, GST, cash flow |
| `/chart-of-accounts` | Account group tree + ledger table |
| `/journal-entries` | Journal/payment/receipt/contra vouchers |
| `/ledgers` | Full ledger listing with type/status filters |
| `/customers`, `/vendors` | Customer/vendor accounts and balances |
| `/sales-invoices`, `/purchase-invoices` | Invoice tracking |
| `/banking` | Cash & bank account balances, transaction feed |
| `/gst` | GST liability summary and return filing status |
| `/financial-reports` | Trial Balance, P&L, Balance Sheet, etc. report launcher |
| `/payroll-accounting` | Auto-generated payroll journal entries |
| `/announcements`, `/support` | Company/admin utilities |
| `/user-roles` | Role permission matrix + demo role switcher |
| `/settings` | Company, Payroll Settings (salary proration), Statutory Configuration (PF/ESI/PT), Tax Configuration (TDS), Notifications, Billing |

## Mock data

All seed data lives in `src/data/mock/*.ts` and is generated deterministically
(no `Math.random()`, so server/client render output matches). Highlights:

- `employees.ts` — 28 employees with realistic Indian names, departments, bank
  details, statutory IDs, etc. Exposes `getEmployeeById`, `departments`, `workLocations`.
- `attendance.ts`, `leaves.ts` — attendance records and leave requests derived from the employee list.
- `payroll.ts` — payroll rows computed from each employee's CTC (PF/ESI/PT/TDS math lives here).
- `payslips.ts` — payslips derived 1:1 from payroll rows.
- `salaryStructures.ts`, `chartOfAccounts.ts`, `accounting.ts`, `financialReports.ts`, `dashboard.ts`.

`formatINR()` in `src/utils/format.ts` handles Indian digit grouping (₹ 48,75,000).

## Service layer (where the backend plugs in)

UI components never import mock arrays directly — they call functions in
`src/services/*.service.ts`. Every function is `async`, returns a `Promise`,
and is marked with `// TODO: Replace mock implementation with REST/GraphQL API.`

```ts
// src/services/employee.service.ts
export async function getEmployees(filters: EmployeeFilters): Promise<Employee[]> { ... }
export async function createEmployee(data): Promise<Employee> { ... }
```

To connect a real backend:

1. Set `NEXT_PUBLIC_API_BASE_URL` in `.env.local` (see `.env.example`).
2. In each `*.service.ts` file, replace the mock-data logic with a `fetch()`
   call to `apiUrl('employees')` (helper in `src/config/api.ts`), keeping the
   same function signature and return type.
3. Nothing in `src/app` or `src/components` needs to change — they only know
   about the service functions' types.

Services currently simulate latency via `mockDelay()` (`src/lib/async.ts`) so
loading states are exercised in the UI; remove that once real network latency
exists.

## Environment variables

Copy `.env.example` to `.env.local` and adjust as needed. Only
`NEXT_PUBLIC_API_BASE_URL` exists today, consumed by `src/config/api.ts`.
It's unused while services run on mock data, but wired up so the switch to a
real backend is a config change, not a refactor.

## State & interactions implemented

- Sidebar routing with active-route highlighting, mobile drawer
- Company / payroll-month selectors, global search input, notifications, quick actions
- Sortable, paginated, searchable/filterable data tables (custom lightweight
  table in `src/components/shared/data-table.tsx` — see note below)
- Employee detail drawer, add-employee form (React Hook Form + Zod)
- Leave approve/reject with optimistic UI + toasts
- Payroll run stepper with confirm dialogs for Process/Approve (simulated
  async processing with loading states)
- Payslip publish/reprocess quick actions with confirm dialogs
- Toast notifications (Sonner), loading skeletons, empty states throughout

> **Note on tables:** the spec called for TanStack Table, but the version
> resolved by `npm install` at build time (`@tanstack/react-table@9`) ships a
> substantially different API than the `v8` surface this app was designed
> against. Rather than depend on an API that could shift again, `DataTable`
> is a small dependency-free implementation (sorting, pagination, loading/empty
> states) with the same column-definition ergonomics. Swap it for TanStack
> Table (or anything else) without touching call sites — the `Column<T>` type
> is the only contract pages depend on.

## Payroll operations engine

The attendance-to-payroll workflow (employee lifecycle, KYC, employee-specific
salary, attendance, statutory configuration, payroll calculation/validation,
audit trail) is powered by a single Zustand store, **not** the lightweight
`data/mock/*` arrays used by the original Phase 1 pages:

- `src/store/operations-store.ts` — canonical in-memory state for employees,
  KYC records, salary profiles, salary revisions/holds, daily attendance,
  payroll periods, audit log, and statutory configuration. Also exports pure
  calculation helpers (`calculatePayrollRow`, `attendanceSummaryFor`,
  `validateEmployeeForPayroll`, `checkDuplicateUAN`, `payrollExceptionsForMonth`, ...)
  that services and components call directly.
- `src/types/operations.ts` — the types for all of the above
  (`EmployeeKYC`, `SalaryProfile`, `DailyAttendanceRecord`, `PayrollCalculation`,
  `PayrollValidationIssue`, `StatutoryConfiguration`, `AuditRecord`, `Role`, ...).
- `employee.service.ts` reads/writes through this store (not its own array),
  so employee data stays consistent across every page — bulk-imported or
  status-changed employees show up everywhere immediately.
- New service files following the same Promise + `mockDelay` pattern as
  Phase 1: `salary.service.ts`, `kyc.service.ts`, `statutory.service.ts`,
  `audit.service.ts`, plus substantial additions to `attendance.service.ts`
  and `payroll.service.ts` (daily attendance, finalization, bulk upload,
  attendance-adjusted payroll calculation, validation engine, exceptions,
  period lock/unlock).

**Statutory calculation disclaimer:** PF/ESI/PT/TDS math in
`operations-store.ts` is a frontend approximation for demo purposes, driven
by editable values under Settings → Statutory/Tax Configuration. Every
calculation path carries a comment to this effect — final statutory
calculation must come from the backend based on applicable law, wage limits,
employee category, state and tax rules.

**Bulk upload** (Employees, Salary, Attendance) shares one generic component,
`src/components/shared/bulk-upload-dialog.tsx`: Download Template → Upload →
Validation Preview → Import Summary. CSV files are parsed for real
(`src/lib/csv.ts`); `.xls`/`.xlsx` selection is accepted but simulated with
sample data, since real spreadsheet parsing would require a client-side
library (`xlsx`/SheetJS) that currently ships with an unpatched
prototype-pollution/ReDoS advisory — not worth adding for a demo feature.
Swap in a patched parser (or a backend upload endpoint) without touching the
dialog's callers.

## Design system

Colors, spacing and the sidebar/canvas layout are defined as CSS variables in
`src/app/globals.css` (Tailwind v4 `@theme` block) — edit them there to
re-theme the whole app. Status colors (`success`/`warning`/`danger`/`purple`/
`cyan`) are mapped centrally in `src/components/shared/status-badge.tsx`.
