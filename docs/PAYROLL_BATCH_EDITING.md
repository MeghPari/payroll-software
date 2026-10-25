# Payroll approval scope and batch editing

Apply `supabase/upgrade-payroll-batch-editing.sql` after the incremental payroll upgrade. Installation does not change existing employee amounts, payroll snapshots or payments.

The Calculate Salaries review now displays only the current batch. Its employee count, totals, preview export and approve/lock confirmation all use that batch's saved rows, not the company directory or previous monthly batches. Requests carry the batch ID and expected version; an appended calculation invalidates a stale confirmation instead of approving newly added employees silently. Monthly client sheets and aggregate reports still include all calculated batches.

For example, 35 company employees with only 10 complete attendance records produce a review/approval/lock for 10 employees. The other 25 remain pending and editable, including attendance uploads. Import validation checks whether the individual employee has a calculated snapshot; an earlier month-wide finalization no longer blocks pending employees once payroll batches exist.

Edit / recalculate this batch (including the locked-batch banner) requires payroll-unlock permission, a reason and confirmation. The database rejects stale or cross-company requests. Reopening archives the batch's run, salary snapshots, components and draft payslips, clears only its calculated results and returns it to Draft. Attendance and employee salary setup are retained, so the administrator can correct them and calculate again. Previous approvals and lock actions remain audited.

Only the current batch can be reopened through this action. Published payslips, accounting entries, prepared/recorded payments and linked corrections require the existing correction workflow. Audited month reset remains available for sample data. Other employees and other batches are never cleared by this action.

Regression coverage creates 35 employees, imports attendance for 10, approves/locks exactly 10, edits their batch with history retained, recalculates the changed attendance and checks publication/tenant/stale protections. Tests run against local Postgres/PGlite with fixture Auth; live project records are not changed.
