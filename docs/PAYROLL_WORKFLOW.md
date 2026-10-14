# Payroll workflow

1. Create the employee with the actual joining date. Configure effective salary, explicit statutory applicability and reviewed applicable rules.
2. Record attendance for each employment date in the selected month. Use a date range for repeated status and record weekly offs/holidays separately. Do not mark future dates Present to bypass validation. Initial records are audited automatically; corrections require a reason.
3. Finalize that month. Incomplete results list missing dates. Dates before joining/after exit are excluded. Resolve Missing Punch entries.
4. Run Validate in Payroll, resolve blocking issues, Calculate, review, Approve and Lock. Financial-input changes require recalculation before approval.
5. Generate/publish payslips for the locked month. PDFs use captured amounts. Publication is distinct from email delivery, which is not implemented.
6. Configure an open financial year and payroll ledger mappings, then post the month's payroll accrual.
7. Configure the company bank in Banking. Review/verify employee holder, account and IFSC in KYC. Identifier changes reset verification.
8. Prepare/export salary instructions in Disbursement for your actual banking process. This does not transfer funds or mark salaries paid.
9. After an actual payment, record date, amount, reference and evidence. Partial payments retain balances; full evidence completes payment. Correct erroneous recorded evidence through Banking while preserving history.

Attendance reopening needs a reason and is blocked by dependent approved/locked payroll. Published payslips and posted accruals protect ordinary payroll unlock. Do not bypass protections with SQL edits.
