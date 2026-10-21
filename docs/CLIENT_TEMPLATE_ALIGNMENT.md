# Client workbook alignment - 18 October 2026

The supplied workbooks have headers and validations but no employee rows or salary formulas. Their contents are reference data, not executable instructions. Originals and extracted workbook contents are not stored in this repository.

## Installation

The user confirmed migrations 001-042 applied. Apply only supabase/upgrade-client-templates.sql once in the existing Supabase SQL Editor. This is migration 043. Do not rerun the previous upgrades or sample salary script. Deploy the matching application changes. Existing rosters retain a compatibility path before this upgrade; new client features require 043.

## Employee Database

Employees > Bulk upload defaults to the client's 30-column Employee_Database format. Upload the original filled .xlsx or matching CSV. A preview validates dates, identifiers, duplicate codes, salary totals and employment dates. The whole batch succeeds or rolls back; existing employee codes are never overwritten. Reporting Manager resolves to a unique active company employee code or full name, including employees in the same batch.

Counter Code/Name, Function, personal details, bank details, UAN/ESI identifiers and Active/Left/Rejoined are retained. Email is optional and single-part names are supported. Left requires a historical leaving date. Rejoined marks this imported employment period; earlier employment periods are not invented. Imported bank details remain unverified.

Structured Basic, S. DA, S. HRA and S. Other Allowance become effective salary components. Choose the effective date explicitly, or explicitly select joining date. S. Gross must equal their sum. S. PF, S. ESI and Total CTC remain supplied reference amounts: the workbook does not establish their employer/employee or monthly/annual basis. They do not set statutory flags or override deductions.

The employee detail screen exposes DA and retained salary references; counters are searchable/filterable in the directory. Authorized users can export the same 30 columns. Exported structured gross covers the four mapped components; bonus/variable pay is not reclassified into those fields. An export is a record of current data, not an overwrite import.

## Attendance

Attendance > Upload accepts the original grid: seven identity columns, actual dates in row 2, daily P/WFH/HD/L/A/H codes and optional summary counts. A month-specific CSV grid can also be downloaded. Per the user's clarification, L defaults to Paid Leave and H to paid Holiday, including Sundays and weekly offs. These choices remain visible in import settings. H is not split into Sunday versus other holiday because the source code does not distinguish them.

P = Present, WFH = Work From Home, HD = Half Day, A = Absent. Blank cells remain unrecorded. Provided summary counts must match daily codes. Employee codes and supplied names must match; all dates must belong to the selected month and fall within employment. No punch times, hours, overtime amounts or automatic presence are invented. Existing attendance correction/finalization controls remain in force.

## Salary Structure

Calculate Salaries > Client salary sheet exposes and exports the exact 40 headings in Salary_Structure.xlsx. Gross, deductions and Final Net Pay come from saved payroll. DA participates in normal effective-date calculation and payslips. Sunday amount, overtime and incentive are separate adjustments; the Incentive display includes Sunday and OT exactly once. Uniform advance, vehicle damage and prior-month recoveries are separate deductions, with balanced existing-ledger posting.

Employer ESI comes from configured payroll rules. Percentage captions are retained from the workbook and do not override reviewed rules. Employer EPF/EPS splits, EDLI, admin charges, insurance, service charge, gratuity and invoice value are a separate reviewed client-cost worksheet. Enter amounts or import a filled salary sheet; mismatching supplied salary/identity/attendance values are rejected. These costs do not alter salary, create a posted invoice or execute payments.

Service charge offers an explicit 4.5%-of-gross suggestion. Invoice total offers an explicit suggestion: saved gross + saved employer ESI + reviewed employer EPF + EPS + EDLI + PF admin + insurance + service charge + gratuity. All seven client-cost inputs must be entered, including explicit zeros, before suggesting the total. The amount still needs a review/source note and save. Salary deductions are not subtracted from client invoice value. No unreviewed statutory rates or applicability flags are inferred from reference amounts.

Advance Salary Paid remains blank until a reliable payment-data mapping is agreed: a salary deduction does not establish that cash was paid. Additional earnings absent from the 40 headings are flagged in Status instead of silently relabelled. Client costs are tied to the payroll run version and require review after calculation or workflow version changes. Current employee identity/bank data is used in the sheet; saved salary snapshots remain authoritative for money.

## File and access limits

CSV and .xlsx input supported; save legacy .xls as .xlsx first. Maximum file size 2 MB, 500 employees/client-cost rows per batch, or 1,000 marked employee-date records for attendance. Split large attendance grids by employees. XLSX declared archive expansion and worksheet dimensions are bounded. Only the first worksheet is read. Formula-only or missing cell values cannot substitute for actual reviewed inputs.

Exports are CSV, not recreated Excel workbooks. The attendance-template download is the original supplied blank XLSX, copied byte-for-byte. Open/import bank account, UAN, Aadhaar and employee-code columns as Text in Excel to retain leading zeros; zeros already lost in numeric source cells cannot be reconstructed. Spreadsheet formula injection is neutralized in CSV exports. Private exports require salary/private-employee permissions, are audited and are not cached. Ordinary employee users cannot use administrative imports.

## Verification and limits

Automated tests read all three original blank workbooks locally and verify exact headers and Excel dates. Synthetic database tests cover private identifiers, mononyms, counters, manager resolution, DA, rollback, reviewed costs, stale versions, new recoveries and balanced payroll posting. Upgrade tests compare protected financial fixtures before and after 043. No actual employee workbook rows, attendance, payroll or payments were written to the live company.

Signed-in client acceptance, live migration application, actual filled workbooks and the client's final billing/statutory conventions still need verification. The spreadsheet authoring runtime was unavailable, so no replacement XLSX artifact was authored through another library; the application reads XLSX and provides CSV exports.

## Attendance can onboard missing employees (044)

After 043, apply supabase/upgrade-attendance-new-employees.sql once. Attendance uploads can now contain a mixture of existing and new employee codes. Preview labels new employees as warnings, not rejected rows. Import creates their employee records and attendance in one transaction. Existing employees are matched and never overwritten. New employees need Employee Name and a real Joining Date (Joining Date / Date of Joining (DOJ) / DOJ in the file, or the upload screen's shared joining-date field). The shared date applies only to missing dates for new employees. For different joining dates, put dates in the file or split the upload. No employment start is inferred from the first attendance date.

The client grid retains Counter Code/Name, Location, State and Function when creating a new employee. Flat CSV accepts Employee ID or Employee Code plus these optional headings. No salary, bank details, statutory applicability or user login is fabricated. Salary can be configured later through the normal employee salary screen. Existing attendance duplicates, employment dates and locked-month controls remain enforced. An error rolls back new employees, attendance and import history together. Both attendance.write and employees.write permissions are required when creating employees; existing-only imports retain attendance.write access.

## Designation salaries and exact original attendance template (046-047)

Apply `supabase/upgrade-designation-salaries.sql` once after 045. Salary Structures includes seven editable sample gross presets: Associate 28,000; Executive 42,000; Senior Executive 56,000; Supervisor 65,000; Team Lead 78,000; Manager 95,000; Senior Manager 120,000 INR/month. Components are Basic 50%, DA 10%, HRA 20%, Other 20%. These are user-authorized sample inputs, not statutory rates or guaranteed net pay.

A matching designation supplies approved preset amounts during employee creation, including employee/attendance imports. Existing custom pay is preserved. Explicit amounts in Employee Database take precedence. Other / Custom keeps manual setup. An administrator can assign defaults to matching employees without pay in one action. Preset edits apply to new assignments; use the employee Salary tab and a reviewed revision date to switch existing pay. Later designation changes on automatic salaries create dated revisions; existing financial snapshots stay unchanged. Unknown designations do not receive guessed salaries. HR users can onboard at approved defaults but cannot edit rates; the employee form retrieves designation names without disclosing salary amounts.

Download Attendance Template serves the exact original XLSX, including its October 2026 headers, formatting and validations. For another month, change the date values in row 2 while retaining the layout. The optional monthly CSV keeps all 31 date positions, with unused slots blank and summary columns fixed. P/A are accepted case-insensitively in flat CSV, grid, API and database and saved canonically as Present/Absent. L defaults to paid leave; H to holiday including weekly offs.

The original template has no joining-date/designation column. For new employees, use the upload screen's shared fields; for mixed designations import Employee Database first or split the attendance upload. Existing employees keep saved profiles and salaries. Bank/statutory setup remains optional for provisional calculation under 041; payment preparation retains its existing bank checks.

## Department-specific designations (048)

After 047, apply `supabase/upgrade-department-designations.sql` once. Employee and attendance onboarding offer department selection followed by relevant designations. Added sample monthly gross INR defaults:

| Department | Designation | Gross |
| --- | --- | ---: |
| IT | Software Developer | 70,000 |
| IT | IT Support Engineer | 40,000 |
| Finance | Accountant | 50,000 |
| Finance | Finance Manager | 90,000 |
| Human Resources | HR Executive | 40,000 |
| Human Resources | HR Manager | 75,000 |
| Sales | Sales Executive | 35,000 |
| Sales | Sales Manager | 80,000 |
| Operations | Operations Executive | 32,000 |
| Operations | Operations Supervisor | 55,000 |
| Administration | Admin Executive | 30,000 |
| Administration | Office Manager | 60,000 |

The seven earlier generic roles remain under General. Other / Custom stays available under each department; existing imported/custom department labels are preserved. Known department-specific designations must match their department; blank departments are supplied from the role. Attendance Function values remain authoritative when present in the file, so choose a matching shared designation or import the employee directory first for mixed roles. Existing salaries and approved financial records are unchanged by migration. The payroll engine calculates from the stored designation assignment with attendance and configured deductions; it does not require manual salary entry per new employee. Rates remain editable in Salary Structures and are sample gross, not guaranteed net. Existing custom pay requires an explicit reviewed switch on the employee Salary tab. Editing a preset does not rewrite past salary revisions.
