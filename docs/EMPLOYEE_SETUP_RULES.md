# Employee setup rules — 25 October 2026

Employees → Salary supports direct entry with the same fields as the Employee
Database: Structured Basic, S. DA, S. HRA, S. Other Allowance, calculated S. Gross,
and optional S. PF/S. ESI/Total CTC reference amounts. Manual and uploaded salaries
use the same four-component payroll resolver; designation defaults remain disabled.
Saved salary fields are read-only. Revise salary explicitly opens a draft, requires a later effective date, and shows an old/new gross confirmation before saving. Cancel revision restores the saved values. Initial salary entry also requires confirmation.
Core amounts are monthly INR values converted to exact paise. PF/ESI/CTC reference
values do not change deduction applicability or invent contribution rates.

The first salary carries across employed months as before; later revisions use
their effective dates. Dates must be within employment. A changed salary requires
a new effective date rather than overwriting a historical assignment. Employee
version checks reject stale submissions. Locked snapshots remain unchanged.

Employee dataset imports require Employee Code, Employee Name and Date of Joining.
Optional metadata, bank identifiers, DOB, PAN, UAN and Aadhaar number can be absent.
If no salary is supplied, the employee is accepted without an assignment and salary
can be added later in the Salary tab. If any salary is supplied, Structured Basic
is required. Missing DA, HRA and Other Allowance become zero. S. Gross is derived
when absent and must match the components when supplied. A gross-only salary is
rejected; no component split is guessed. Missing optional values on an update
preserve existing contact, employment, bank, private and salary data. Clear an
optional value explicitly through the employee editor when needed.

Attendance requires an employee code, actual date and recognized status. Existing
employees need no repeated name or joining date. New employees require a name and
joining date in the file or upload settings. Both the exact client monthly grid
and grids with optional metadata/summary columns omitted are accepted. Empty daily
cells remain unrecorded; they do not create absences. Full-month completeness is
still checked at finalization. Invalid supplied values, duplicates, wrong-month
dates, conflicting identities and attendance outside employment remain errors.
The original downloadable attendance template is unchanged.

Aadhaar is the only required KYC document. KYC completes when an Aadhaar card is
uploaded and verified through Documents. Pending, rejected, uploading or removed
documents do not satisfy completion. The status is derived in the database and
re-evaluated after document changes. PAN, bank proof, cancelled cheque and other
documents are optional for this completion status. KYC completion is separate
from payroll readiness and actual bank-payment requirements; employees may be
created and payroll tested before KYC completion.

Apply supabase/upgrade-manual-salary-imports-kyc.sql once after the month-reset
upgrade. It adds the salary entry RPC and KYC requirement RPC and replaces the
dataset import function; it does not recalculate or delete existing payroll.
Tests use local Postgres and fixture Auth/Storage metadata, not live client files.
