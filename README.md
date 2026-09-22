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
                           AlertCard, PayrollStepper, AccountTree, charts/, etc.
    employees/             Employee-specific pieces (detail drawer, add-employee form)
    ui/                    shadcn/ui primitives (button, dialog, table, ...)
  config/
    api.ts                 API base URL / timeout config for future backend wiring
    nav.ts                  Sidebar navigation structure
  data/mock/               Realistic seed data (25+ employees, payroll, ledgers, ...)
  services/                 Promise-based data-access functions (see below)
  store/                   Zustand store for company/month selection, sidebar state
  types/                    Shared TypeScript interfaces and unions
  utils/                    formatINR, pluralize, initials, etc.
  lib/                      cn() className helper, mockDelay()
```

## Routes

| Route | Purpose |
|---|---|
| `/dashboard` | Company-wide KPI overview, payroll/accounts summary, charts |
| `/employees` | Employee directory, filters, detail drawer, add-employee form |
| `/salary-structures` | Manage earning/deduction components per structure |
| `/attendance` | Attendance summary, leave requests/approvals, leave balance, upload history |
| `/payroll` | Guided payroll run: stepper, validation alerts, review table, approve/lock |
| `/payslips` | Payslip list, status donut, bulk publish/download/reprocess actions |
| `/disbursement` | Salary disbursement status per employee |
| `/compliance` | Statutory filing checklist + payroll alerts |
| `/payroll-reports` | Payroll-specific report library (PF, ESI, TDS, F&F, ...) |
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
| `/announcements`, `/user-roles`, `/settings`, `/support` | Company/admin utilities |

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

## Design system

Colors, spacing and the sidebar/canvas layout are defined as CSS variables in
`src/app/globals.css` (Tailwind v4 `@theme` block) — edit them there to
re-theme the whole app. Status colors (`success`/`warning`/`danger`/`purple`/
`cyan`) are mapped centrally in `src/components/shared/status-badge.tsx`.
