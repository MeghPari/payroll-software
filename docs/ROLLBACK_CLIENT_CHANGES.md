# Restore the version before Employee Master and monthly deletion

The application commits were reverted in `7db0f3e`. If both SQL upgrades 049
(`upgrade-employee-master.sql`) and 050 (`upgrade-delete-month-attendance.sql`)
were already applied, run the entire `supabase/rollback-client-changes.sql` in
the existing project's Supabase SQL Editor as project owner. Refresh the app
after it completes. Do not rerun old upgrade packages.

The rollback restores the function definitions and application grants from
migrations 001–048, including designation salaries, manual/custom salaries,
attendance imports that can create employees, and earlier payroll validation.
It revokes application access to the added master and month-deletion functions.
Additional master-history tables and columns remain with application access
disabled so imported history and foreign keys are retained.

Existing designation presets are reactivated without replacing their amounts.
Migration 049 overwrote individual active statuses without recording their
previous values. Previously intentionally inactive presets must be disabled
again; exact restoration of those flags requires a pre-upgrade backup.

This rollback preserves current employees, salary assignments, attendance,
audit records and financial history. It does not reconstruct attendance that
was actually deleted or undo employee/salary uploads made after the upgrades.
It also does not recalculate existing payroll. No live changes are made by
creating this script; the SQL must be run against the project.

Validation: `node scripts/test-rollback-client-changes.mjs` replays 001–048,
creates retained payroll/attendance fixtures, applies the exact reverted
049/050 SQL from Git, applies the rollback twice, checks function definitions
and grants, compares business records, and exercises the restored designation
salary, payroll and new-employee attendance import tests.
