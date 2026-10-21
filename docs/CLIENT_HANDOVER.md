# Client handover - attendance and salaries

PayFlow is available at https://payroll-software-iota.vercel.app. Each authorized user signs in with their own account from any computer. Company data is stored in the shared Supabase project.

## Add client accounts

1. In Supabase Authentication, create or invite the client's account. Confirm its email before assigning access. Configure production SMTP before relying on invitation/password-reset delivery to client addresses; Supabase's default mailer is restricted to project team addresses.
2. In PayFlow, open Company > User Roles > Assign User. Enter the confirmed account email and choose the role. Payroll Admin handles attendance/salary processing; Finance handles payments/accounting; Super Admin manages user access and company setup. Review the displayed permission matrix.
3. The user signs in at the hosted address. Use the password-reset option to set a private password once email delivery is configured. Never share your own administrator account.
4. For employee self-service, also link the confirmed account from the employee's Employment tab. Employee creation, account creation and company membership are separate steps.

An invitation is not sent by Assign User. Public self-registration and an in-app Auth invitation service are not implemented.

## Employee Database-first payroll

The client workflow is now Employee Database upload ? Attendance upload ? Code matching ? Payroll preview ? Generate/approve/lock ? Export/payment preparation. See [the current workflow](EMPLOYEE_DATABASE_WORKFLOW.md) for exact fields, re-upload policy and unresolved PF/ESI meanings. Salary comes only from the uploaded employee-specific components; roles do not supply pay. Existing sample/manual employees must be imported from the actual Employee Database before new calculations.

Select the month, import attendance for already imported Employee Codes, review matching/missing dates, finalize attendance and calculate the preview. Review contractual versus earned amounts and configured deductions before approval/locking. Bank details and unknown statutory flags retain the prior provisional-calculation policy; reviewed rules are required for explicitly applicable deductions. Complete and verify banking before payment preparation. Bank instructions do not mean funds were transferred. Preserve the audited correction workflow for protected payroll and payments.

## Deployment update

Apply **supabase/upgrade-employee-master.sql once after migration 048**. It retires presets while retaining protected financial history. Do not rerun setup, older packages or sample salary scripts. Source deploys through the existing repository/Vercel connection. Live application of 049 remains pending.

## Before relying on hosted delivery

Confirm the Vercel function region is close to the actual Supabase database region, and measure signed-in page latency before changing regions. Validate client login/recovery, private document uploads, two-user edits and backup restoration against the hosted services. Browser acceptance could not be completed in this development session.

See [research and rationale](PAYROLL_EXPERIENCE_RESEARCH.md) and [implementation status](IMPLEMENTATION_PROGRESS.md) for scope and unresolved integrations.
