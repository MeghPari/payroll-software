# Reset attendance and payroll for a month

Monthly review → Clear attendance now resets the selected company/month rather
than blocking simply because payroll was approved or locked. When a payroll run
exists, the dialog shows counts of salary results, payslips, recorded payments
and linked journals. An additional acknowledgement, typed month and mandatory
remark are required. Only an administrator with `payroll.reset` can reset a
payroll month; the permission is granted to Super Admin by default.

The reset removes attendance/finalization, the payroll run, computed salary rows,
approvals/lock/calculation history, payslips/notifications, payment instructions,
attempts, recorded payments, associated bank transactions, payroll/payment
journals and their reversals. It also removes that month's adjustments, holds
and client payroll cost entries. Linked bank reconciliation matches are cleared
and the affected statements reopened, with their actual statement lines retained.

It retains employee profiles, uploaded salary assignments/components, bank
account configuration, calendars, leave requests, original import batch history,
other payroll months, unrelated invoices/journals and existing audit logs.
Linked payment/reversal entries can have dates after the payroll month; selection
uses their actual payroll relationship, not an arbitrary calendar date delete.
Actual bank transfers are not reversed by deleting their in-app evidence.

Before removal, complete selected row images are saved in a private, RLS-protected
reset archive with company, month, operator and remark. The ordinary audit trail
contains the archive ID and removed counts. The app cannot edit/delete archives.
This is a transactional reset: all normal triggers and foreign keys remain on.
Unexpected dependencies fail atomically. A later month's correction referencing
the source payroll, or an invoice sharing a selected journal/payment, must be
resolved before reset; the reset never silently deletes another month's correction.

After reset, upload attendance again, finalize it, calculate from the preserved
employee dataset components, then review/lock/pay as required. Existing snapshots
are not reused. Preview tokens include input version, run state and linked record
IDs/counts to reject stale confirmation.

Run `supabase/upgrade-reset-payroll-month.sql` once after the clear-attendance
upgrade. Installation creates the action and archive table; it resets no live
month. Do not rerun earlier rollback packages.

Local verification: `node scripts/test-month-reset.mjs` exercises locked and
published payroll, posted accrual, two payments with reversals, failed/retry
attempts, archive preservation, permissions, mandatory acknowledgement/remark,
stale confirmation, other-month correction dependencies, unrelated invoices and
the real HTTP handler including a locked payroll with zero attendance. Auth and
REST transports are fixtures; no live data is changed by these tests.
