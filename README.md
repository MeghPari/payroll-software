# PayFlow ? Payroll, HR and Accounting

Next.js 16 / React 19 / TypeScript application with authenticated Supabase backend, tenant permissions, audit records and exact-paise payroll/accounting workflows. Integrated screens use real APIs; unsupported individual operations remain disabled or explicitly unconfigured.

The full requested platform is still in progress and is not verified for production. See [implementation progress](docs/IMPLEMENTATION_PROGRESS.md), [test results](TEST_RESULTS.md), [setup](docs/DEPLOYMENT_GUIDE.md) and [payroll workflow](docs/PAYROLL_WORKFLOW.md).

## Run locally

Configure the ignored .env.local using .env.example, then run npm install and npm run dev. Open http://localhost:3000/login. The user confirmed migrations 001-040 applied successfully for SVS Corporate Services. All existing SQL packages are applied; do not rerun them or bootstrap.

## Implemented modules

Employees and sensitive identity/KYC, salary structures/revisions/imports, attendance and leave, validation/calculation/approval/locked payroll, captured payslips/PDF, ledgers/journals/payroll accrual, customer/vendor invoices, recorded bank/salary payment evidence, dashboard, membership administration and financial/payroll reports.

Preparing/exporting instructions does not transfer funds. Publication does not send email. Contribution summaries are not statutory filings. Private employee documents, reviewed calendar/proration, GST book archives, compliance evidence, announcements/support, payment retries and additional reports are implemented locally. Broader statutory models and remaining scope are documented in the progress file.

## Checks

npm test; npm run typecheck; npm run lint; npm run build. Additional checks: node scripts/test-upgrade.mjs, node scripts/test-payslip.mjs and node scripts/test-http.mjs with TEST_APP_URL set to the running server. Fixtures do not change live user records or establish production readiness.

## Structure

src/app/api holds authenticated Route Handlers; src/server holds authorization/provider/error handling; src/domain holds financial/date/report logic; src/services connects existing screens; supabase/migrations contains transactional schema/RPC/RLS changes; supabase/tests and scripts contain executable checks.
