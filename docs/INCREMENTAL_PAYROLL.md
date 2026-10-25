# Incremental monthly payroll

Apply the entire `supabase/upgrade-incremental-payroll.sql` after the manual salary/import/KYC upgrade, then deploy/refresh the application. Installation retains existing monthly payrolls as batch 1. Do not rerun older payroll upgrades after this migration.

Calculate ready employees processes only employees with attendance on every employed date in the month (joining/exit dates included, Missing Punch excluded), a salary, and valid applicable payroll configuration. Incomplete employees stay pending; their records do not block other employees. Global attendance finalization is optional. Blank dates are never treated as absence or paid attendance.

Calculation appends newly eligible employees to the current unapproved batch. Lock an approved batch before starting another. After locking, the next calculation creates another batch in the same month. Repeated calculation without newly eligible employees changes nothing. A database unique constraint prevents an employee being calculated twice for the same month, including concurrent requests. Each batch retains its own approval, lock, snapshot, accounting accrual, payslips and payment instructions. Employees already calculated are marked by batch/status on the monthly attendance register.

Calculated employees' attendance is protected. This action adds pending employees; it does not overwrite an earlier employee's salary or confirmed payments. Correct an existing calculated employee through the existing month reset (sample data) or reviewed correction workflow. Salary/statutory/calendar changes to a calculated employee are checked before approving a new snapshot; unrelated employees completing attendance do not invalidate approval.

The monthly salary sheet and reports include all batches. Salary Payments provides a batch selector to revisit older partial payments or prepare another batch. Preparation records instructions only; actual payments still require bank confirmation/evidence. Existing recorded amounts are retained and excess payments are rejected. The monthly workflow is complete only when all calculated batches have the required publication/posting/payment state. An uncalculated employee remains pending, not paid.

The month-reset preview/archive/delete action covers all batches for the selected month, including linked payments and accruals, with its existing mandatory remark and payroll-reset acknowledgement. It does not reverse actual bank transfers.

Verification uses local Postgres/PGlite and fixture Auth/REST transports. No live payroll/payment records were changed. Signed-in browser acceptance and applying SQL in the client project are separate deployment steps.
