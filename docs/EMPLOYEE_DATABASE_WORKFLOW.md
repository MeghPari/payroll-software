# Employee Database is authoritative (migration 049)

This replaces the designation/preset workflow from 046–048. Designation and Function describe an employee; they never determine salary. No percentage split, CTC conversion, role default or sample salary is used in new payroll. The obsolete demo store, mock data, preset UI and independent salary editors/import screens and the old calendar-only estimate have been removed. Payroll preview now uses the configured engine. Historical migrations remain to reproduce schema history. Existing preset structures are archived and their entry points disabled; their records remain only for historical references.

## Client workflow

1. Open **Employee Database** or **Uploaded Salary Data**, then **Upload Employee Database**. Download is the original blank Employee_Database.xlsx, copied unchanged. Matching CSV is also supported. All 30 original column names are preserved.
2. Supply each employee's actual information and all eight salary fields. Blank salary cells fail validation; enter an explicit zero where appropriate. Structured Gross must equal uploaded Basic + DA + HRA + Other Allowance. Monetary amounts are parsed to integer paise, not split from CTC. Preview includes each component and salary references; validation issues can be downloaded.
3. Choose **Create new employees only**, or explicitly **Create new and update matching Employee Codes**. Codes are trimmed and normalized to uppercase. Duplicate normalized codes in a file or company are rejected. Different employees can have identical names; attendance never matches by name. Manager names are only a secondary reference for the manager relationship, with ambiguous names rejected.
4. For first salaries, choose the employee's joining date or another reviewed effective date. For a changed salary, supply a new revision date. An existing revision date is never silently overwritten. Unchanged data does not create another salary assignment. Updates check the employee versions captured at validation; refresh/revalidate after a concurrent change. A failed batch rolls back all its rows.
5. Select the month and upload attendance using the existing original attendance grid or flat CSV. P/A, WFH, HD, L and H remain supported. L defaults to paid leave, H to paid holiday including weekly offs, as previously confirmed. Names are informational. Unknown or non-imported Employee Codes are errors; attendance cannot create employees or infer their salary or joining dates.
6. Review the upload reconciliation: imported employee count, employee codes in this file, matched employees, unmatched records and employees missing from this file. Blank days remain missing, not absent or present. Existing date/employee duplicates require the audited correction workflow rather than an import overwrite. Change settings and use **Validate selected file again** when correcting an import.
7. In Calculate Salaries, review the persisted master/attendance matching table and payroll validation. Missing imports, salary source, attendance days, unresolved punches, employment-date conflicts, holds or required reviewed rules block processing. Inactive/Salary Hold and historical join/exit eligibility follow the existing engine. Every eligible employee must have a matched attendance upload for that period. There is no silent partial payroll excluding unresolved employees.
8. Finalize complete attendance, calculate the payroll preview, inspect **Uploaded salary versus earned payroll**, then approve and lock. Download **Export payroll CSV**, which Excel can open. The existing 40-column client salary sheet remains available; it is an earned-salary/billing layout, separate from the contractual master.

## Original columns and meaning

The first 22 headers map to employee identity, private personal/statutory identifiers, employment dates/status, counter, reporting manager, location, state, Function/department, Designation and bank details. The remaining headers are exactly:

| Uploaded column | Stored meaning |
| --- | --- |
| Structured Basic | Contractual monthly basic, exact paise |
| S. DA | Contractual monthly DA |
| S. HRA | Contractual monthly HRA |
| S. Other Allowance | Contractual monthly other allowance |
| S. Gross | Uploaded contractual gross, validated against those four components |
| S. PF | Unclassified uploaded reference; not automatically a deduction or employer cost |
| S. ESI | Unclassified uploaded reference; not automatically a deduction or employer cost |
| Total CTC | Uploaded employer-cost reference; never treated as take-home pay |

The existing internal salary tables are reused as an exact component ledger. A neutral component schema has no salary amounts or percentage rules; each employee assignment receives only that employee's uploaded values. Complete original rows are retained in append-only, permission-protected master revisions. No real client master has been invented or imported by development tools.

## Reused rules and unresolved client decisions

| Topic | Current behavior / decision needed |
| --- | --- |
| Proration | Existing company configuration: calendar-day or reviewed working-day basis. The engine sums exact daily component weights and rounds at component total. No new denominator was introduced. |
| Rounding | Existing company payroll rounding is retained and captured by calculation method and snapshots. |
| Paid leave and holidays | Previously confirmed L = paid leave; H = paid holiday, including Sundays. Their existing paid-day rules remain. Half Day retains the existing half-day weight. |
| Joining/leaving | Attendance must lie within actual employment. Prior engine employment eligibility and daily salary segmentation remain. |
| First salary coverage | The prior user-requested 045 policy remains: first imported salary covers earlier employed dates; later revisions retain effective dates. No joining date is invented. |
| Overtime/incentives/recoveries | Existing reviewed monthly adjustment workflow remains. No rate or amount is inferred from an attendance code. |
| PF/ESI references | Client must confirm whether S. PF/S. ESI are employee deductions, employer contributions or reference costs, and their treatment under proration. Until confirmed they remain references. Existing explicit applicability flags and reviewed, dated statutory rules control actual deductions. |
| Unconfigured statutory setup | Existing 041 policy remains: warnings and provisional net pay. Explicitly applicable deductions still require reviewed rules. No new statutory rates, caps or thresholds are embedded. |
| CTC and invoice values | Uploaded CTC is retained, not recalculated. Existing client-cost reviews remain separate from net salary. No new invoice/CTC formula is inferred. |

## History and exports

Salary changes append assignments and immutable source revisions. Generated payroll snapshots capture contractual components/revisions, source revision ID, payroll identity, attendance totals, proration/calendar basis, rule versions, reviewed adjustments, earned components, deductions, employer contributions and final net pay. New-format historical exports use these snapshots and the captured master revision, not today's employee values. Original legacy snapshots remain unchanged; missing original source information is labelled historical rather than fabricated.

Contractual monthly columns in the new payroll output show the last applicable contract in the period. A separate revisions-used column preserves contracts used for mid-month changes. Earned figures always come from saved calculation results. Approve/lock, stale-input guards, unique company/month runs, payment evidence and payroll correction controls remain in force.

## Applying the upgrade

Run **supabase/upgrade-employee-master.sql once after 048**. Do not rerun setup, sample salary scripts or older upgrade packages. Existing companies/users, approved or locked payroll, published payslips and posted/paid financial records are preserved. Legacy employees and salary assignments are not falsely marked imported: upload the actual Employee Database before new calculations. Existing attendance data is retained. After uploading the actual masters, use **Match saved uploads** in the reconciliation table to explicitly match previously saved CSV attendance. This creates matching/audit records without altering attendance, inventing dates or duplicating employee-date entries. Manually entered rows are not relabelled as file uploads. Actual attendance changes retain the audited correction/reopening workflow; locked periods are not rewritten.

The new normalized-code index rejects companies with pre-existing codes differing only by case/outer spaces. Resolve such identifiers deliberately before applying the upgrade; the migration does not choose an employee or rename codes silently.

## Delete a month's attendance (050)

After 049, run `supabase/upgrade-delete-month-attendance.sql` once. Applying it does not delete records. Super Admin and HR Admin receive `attendance.delete`. Refresh the session/page to load the permission. In Attendance → Monthly review or Upload Attendance, select the month and choose **Delete month's attendance**. The dialog shows the actual record count, requires typing YYYY-MM and a reason, and rejects a stale review if attendance/payroll inputs change before confirmation.

Finalized attendance must first be reopened through the existing authorized workflow. Deletion is blocked for payroll with approval history, payslips, accounting postings or disbursement batches, including protected payroll that was subsequently unlocked. An open month's attendance records and matching markers are removed atomically; any unapproved salary preview is cleared and its run reset to Draft. Employee master/salary data, other months, leave requests, import batches and audit history remain. Re-import or record the month's actual attendance, reconcile/finalize and recalculate. The app does not provide undo. No live records are deleted by development tools.

## Verification

- Existing database tests run through 048 as historical regression coverage, then migration 049 and the new authoritative-workflow tests run on the same engine.
- SQL tests cover full/partial attendance, different salary structures, missing master/attendance, duplicate codes/dates, mid-month joining/leaving, incomplete salary, unchanged re-uploads, exact paise, reproducible recalculation and later salary revisions without changing locked results.
- The actual master import, attendance import, reconciliation, calculation/approval/lock and payroll-export handlers are tested together with PostgreSQL. Tests verify same-name employees remain separate, unknown attendance is rejected, and finalized CSV remains byte-identical after a later revision. Auth and PostgREST transports are fixtures.
- Packaged-upgrade tests compare protected payroll, payslip, accounting and payment fixtures before/after 049. Original workbook headers and unchanged template bytes are checked locally.
- No live schema or real employee/payroll/payment records were changed by these tests. Signed-in browser acceptance remains unverified because the browser connection could not initialize.
