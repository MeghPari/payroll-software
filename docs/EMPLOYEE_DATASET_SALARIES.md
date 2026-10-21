# Employee dataset salaries

Upload Employee Dataset (CSV or XLSX with the existing Employee Database
headers), upload attendance for the payroll month, finalize attendance, then
calculate salaries. The entry points are Employees → Bulk Upload and Employee
Salaries → Upload Employee Dataset.

Structured Basic, S. DA, S. HRA and S. Other Allowance are monthly rupee amounts.
Each is required; use 0 for components that do not apply. S. Gross, when supplied,
must equal their sum. No percentage split or designation salary is invented.
S. PF, S. ESI and Total CTC remain reference values. Existing reviewed statutory
settings and adjustments continue to control actual deductions. Bank details
remain optional for salary calculation.

For existing staff, explicitly enable updates matched by Employee Code.
The preview captures employee versions and stale imports are rejected. Supplied
profile fields replace their saved values, including blank optional fields.
Choose joining date for the first salary, or a reviewed revision date. The first
uploaded salary carries back/forward across employment months, as before;
subsequent revisions apply from their effective dates. Identical salary values
on the same date are reused. Changed values require a new revision date. If an
old preset/manual assignment occupies the date, select a new dataset revision
date; the first dataset salary will still cover earlier employed months.

Only dataset salary assignments participate in future payroll and previews.
Built-in preset amounts and automatic designation assignment are disabled.
Missing uploaded salary remains a validation issue rather than using an old
preset amount. Existing saved payroll, salary history and attendance are retained.
Unapproved calculations must be recalculated before approval. Locked payroll
and its snapshots remain unchanged. Attendance formats and the attendance
template are unchanged by this change.

Apply `supabase/upgrade-employee-dataset-salaries.sql` once after 001–048.
If the reverted 049/050 upgrades were applied, run the previously supplied
`rollback-client-changes.sql` first. Do not rerun that rollback after this upgrade.
The new package works on both the original 048 database and the database after
the 049/050 rollback. Source deployment does not apply SQL automatically.

Validation: `npm test` includes original historical coverage through 048 plus
current dataset import/payroll tests on both upgrade paths. The new tests run
actual route handlers and Postgres functions with fixture auth/REST transport,
checking exact pay for different uploaded amounts on the same designation,
P/A/L/H attendance, updates/revisions, missing components, stale versions,
cross-tenant denial, atomic rollback, and retained financial snapshots.
