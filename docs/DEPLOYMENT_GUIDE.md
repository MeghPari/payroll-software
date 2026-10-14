# Setup and database upgrades

## Existing SVS Corporate Services project

The user confirmed migrations 001-040 applied successfully, most recently upgrade-payroll-finance.sql. Preserve the existing Auth user and company. Do not rerun setup.sql, upgrade.sql, upgrade-next.sql, upgrade-remaining.sql, upgrade-followup.sql, upgrade-payroll-finance.sql or bootstrap_company.

The applied supabase/upgrade-payroll-finance.sql contains migrations 036-040. The user confirmed successful execution; do not rerun it. It adds reviewed prior-payroll corrections, cash-flow classification, actual within-month salary payment dates, exact half-paise proration rounding and verified session context. Recalculate unapproved payroll after applying. Calculation/approval through the application requires migration 039. The publishable key cannot apply migrations. The package is transactional and tested against existing financial fixtures.

It does not calculate/finalize payroll, change attendance, send transfers or file returns. Existing calendar-proration snapshots, published payslips and recorded payments remain unchanged. Reload the deployed PayFlow address, or http://localhost:3000/login for local development, and verify the new workflows with your existing account. MIGRATION_REQUIRED identifies a missing requested function/table.

## New installations

Use either all ordered migration files through a migration runner, or the SQL Editor packages in order: setup.sql (001-002), upgrade.sql (003-018), upgrade-next.sql (019-020), upgrade-remaining.sql (021-031), upgrade-followup.sql (032-035), upgrade-payroll-finance.sql (036-040). Do not use both methods. Packages are one-time scripts, not idempotent reruns.

Create and confirm an Auth user, then bootstrap the first company in the privileged SQL Editor using its UUID. Additional confirmed users receive memberships through User Roles. Link an employee record to the verified account UUID in its Employment tab when own-record access is needed. No default password or public signup is created.

## Application and verification

## Client access from multiple computers

The deployed address is https://payroll-software-iota.vercel.app. Earlier hosted checks exposed missing configuration and then an incorrect SUPABASE_URL. The user confirmed hosted login works after correcting the URL and redeploying. Configure Production SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and APP_URL in Vercel, with APP_URL set to that exact HTTPS origin. Redeploy after saving environment variables. The login entry fix redirects missing-configuration navigation to /login and removes the dashboard shell from the login page; it cannot replace the missing server environment settings.

PayFlow is a browser application backed by a shared Supabase database. The client's authorized accounts can sign in from different computers once the Next.js application is hosted at a stable HTTPS address. Each browser has its own session; company membership and role permissions continue to apply. Use individual accounts for staff and grant the appropriate roles through User Roles.

localhost addresses refer to the computer opening the link. They are for development, require the local server to remain running, and are not the client's permanent address.

For hosted deployment, configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in the hosting project's server environment. Set APP_URL to the exact public HTTPS origin, then build/deploy the application. Keep the existing Supabase project and company; do not bootstrap a replacement. In Supabase Authentication URL Configuration, set Site URL to the public origin and allow the exact recovery redirect used here, /login?reset=1. Review the recovery email template's /auth/confirm flow against the same public origin. Test login and recovery from a separate computer before client handover.

Vercel environment setup: https://vercel.com/docs/environment-variables
Supabase redirect configuration: https://supabase.com/docs/guides/auth/redirect-urls

## Local verification

Keep SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and APP_URL in ignored .env.local; see .env.example. Normal operations use the authenticated user's JWT and do not require a service-role key. Run npm run dev for localhost:3000.

Run npm test, npm run typecheck, npm run lint and npm run build. Additional checks: node scripts/test-upgrade.mjs and node scripts/test-payslip.mjs. Set TEST_APP_URL=http://localhost:3000 before running node scripts/test-http.mjs.

Before release, verify live authenticated tenant/role access, session revocation/recovery, private Storage upload/download/review/removal, simultaneous writes, configured payroll rules, reconciliation and visual rendering. Fixture Auth/REST/Storage tests do not verify the live providers. Direct Supabase RPC traffic remains subject to RLS/permissions rather than the application's HTTP quota counters.

Before a production schema upgrade, take a backup and test restoration into a separate project, including Auth dependencies and separately backed-up private Storage. No restoration or deployment has been performed here. Automated bank execution, email, filing and billing require separately configured providers. See IMPLEMENTATION_PROGRESS.md for outstanding scope.
