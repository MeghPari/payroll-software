# Client handover - attendance and salaries

PayFlow is available at https://payroll-software-iota.vercel.app. Each authorized user signs in with their own account from any computer. Company data is stored in the shared Supabase project.

## Add client accounts

1. In Supabase Authentication, create or invite the client's account. Confirm its email before assigning access. Configure production SMTP before relying on invitation/password-reset delivery to client addresses; Supabase's default mailer is restricted to project team addresses.
2. In PayFlow, open Company > User Roles > Assign User. Enter the confirmed account email and choose the role. Payroll Admin handles attendance/salary processing; Finance handles payments/accounting; Super Admin manages user access and company setup. Review the displayed permission matrix.
3. The user signs in at the hosted address. Use the password-reset option to set a private password once email delivery is configured. Never share your own administrator account.
4. For employee self-service, also link the confirmed account from the employee's Employment tab. Employee creation, account creation and company membership are separate steps.

An invitation is not sent by Assign User. Public self-registration and an in-app Auth invitation service are not implemented.

## Monthly routine

1. Select the company and month. Months are newest first.
2. Open Attendance. Record daily statuses or upload the attendance sheet, review missing dates and configured nonworking days, then finalize the complete month.
3. Open Calculate Salaries. Calculate, inspect each employee's payable days, earnings, deductions and net pay. Optionally compare with the previous saved month; flags are review prompts, not confirmed errors.
4. Missing bank details and unknown statutory flags do not block calculation. Unconfigured deductions are excluded, and the result remains provisional until statutory setup is reviewed and payroll recalculated. Explicitly applicable deductions still require reviewed rules.
5. Approve and lock the reviewed salaries. Changes after calculation require recalculation; protected published records use the correction workflow.
6. In Salary Payments, configure salary ledger mappings once, post the locked payroll entry, select the funding account and prepare instructions. Complete and verify employee bank details before this step.
7. Download the instructions and perform transfers through the bank. Record confirmed payment references and evidence. Prepared/exported instructions do not mean money was transferred.
8. Generate and publish payslips. Saved provisional-pay notices remain visible in the generated PDF.

The sample salaries for Adarsh and Harsh are testing inputs. Replace them with client-reviewed effective salary components before real payments. The sample attendance CSV is an example, not evidence of actual employee attendance.

## Deployment update for this review

The user confirmed migration 041 was applied. Run supabase/upgrade-client-review.sql once, after 041. It installs migration 042 and preserves existing company/users and protected payroll/payment history. Do not rerun earlier packages. Source changes deploy through the connected repository/Vercel project.

## Before relying on hosted delivery

Confirm the Vercel function region is close to the actual Supabase database region, and measure signed-in page latency before changing regions. Validate client login/recovery, private document uploads, two-user edits and backup restoration against the hosted services. Browser acceptance could not be completed in this development session.

See [research and rationale](PAYROLL_EXPERIENCE_RESEARCH.md) and [implementation status](IMPLEMENTATION_PROGRESS.md) for scope and unresolved integrations.
