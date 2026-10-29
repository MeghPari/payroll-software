# Payslips module

## Activate

1. Run the entire `supabase/upgrade-payslips-module.sql` in Supabase SQL Editor after the existing payroll upgrades (through `upgrade-payroll-readiness-reasons.sql`). Apply it once. It adds payslip-specific functions, a month index, draft revision history and email-attempt history. It does not recalculate or delete existing data.
2. Configure server-only deployment variables:
   - `RESEND_API_KEY`: a Resend key allowed to send email.
   - `PAYSLIP_FROM_EMAIL`: a sender on a verified Resend domain, for example `Payroll <payroll@your-company.example>`.
3. Redeploy after adding the variables. Never put these values in `NEXT_PUBLIC_*` variables or browser code.

Resend setup: [verified sending domains](https://resend.com/docs/dashboard/domains/introduction), [send-email API](https://resend.com/docs/api-reference/emails/send-email).

## Workflow

- Select the payroll month. Employees appear even before their payslips exist. Department, employee code, gross/net and generation readiness come from existing employee and saved payroll data.
- Calculate, approve and lock payroll through the existing workflow. Payslips use the saved, attendance-adjusted earnings and deductions without calculating salary again.
- Select employees and generate payslips individually or in bulk (up to 100). Incomplete source details and unlocked payroll are rejected.
- Preview or download a PDF. Select up to 25 generated slips to download a ZIP. Filenames include a unique slip reference.
- Regenerate a draft if needed. The previous content and generation metadata are archived. Published content cannot be overwritten. Downloading a published PDF rebuilds its presentation from its preserved content.
- Publish individually or in bulk. This makes slips available to the employee through the existing access rules. Publication does not send an email automatically.
- Email published slips individually or in bulk after reviewing the confirmation. Bulk email is sent in groups of five to bound each server request. Missing employee work emails are rejected.
- Inspect **Email & generation history** for timestamps, recipients, provider references and prior draft generations. The history dialog displays the latest 100 entries of each kind; older entries remain stored.

## Email outcomes

- **Sent** means Resend accepted the message. It does not claim inbox delivery, opening, or payment. The dashboard counts employees with an accepted send, not repeated attempts.
- **Failed** means configuration or a confirmed provider rejection prevented acceptance. Correct the issue and use **Retry failed email** (or **Email / retry selected**).
- **Sending / Unconfirmed** are deliberately protected against another send. A timeout can occur after the provider accepted the message; inspect Resend's logs and the recorded attempt before an administrator reconciles the outcome. These states are not silently reported as failures or successes.
- Each accepted request has a unique provider idempotency key. Duplicate API requests and repeated sends of an already-sent slip are blocked.
- No delivery webhooks are installed. No actual emails are sent by automated tests.

## Scope and files

Product changes are limited to:

- `src/app/payslips/page.tsx`
- `src/services/payslip.service.ts` (additive module methods; existing methods retained)
- `src/domain/payslips-module.ts`
- `src/server/payslip-pdf.ts`
- `src/server/payslip-email.ts`
- `src/server/payslip-zip.ts`
- `src/app/api/payslips/dashboard/route.ts`
- `src/app/api/payslips/manage/route.ts`
- `src/app/api/payslips/email/route.ts`
- `src/app/api/payslips/zip/route.ts`
- `supabase/migrations/20261029113923_payslips_module.sql`
- `supabase/upgrade-payslips-module.sql` (SQL Editor copy)
- `.env.example` (optional payslip email variables)

Verification changes:

- `scripts/test-payslips-module.mjs`: real PostgreSQL-engine tests for generation, archival, publication, email states, permissions, immutable figures and unchanged attendance/payroll.
- `scripts/test-payslips-delivery.mjs`: actual HTTP handlers with inert auth/provider transports; PDF output, ZIP CRC, email request attachment and provider outcome classification.
- `package.json`: includes both suites in `npm test`; no new runtime dependency.
- `scripts/test-database.mjs`, `scripts/test-rollback-client-changes.mjs`, `scripts/test-sample-salary.mjs`: retain their existing historical migration boundary by excluding the new payslip migration.

The pre-existing uncommitted Aadhaar/document-tab changes are separate from this task. Employee, attendance, salary-calculation, accounting, disbursement and payment code are not changed by this implementation.

## Verification

The full automated suite, ESLint, TypeScript and production build passed. Sample PDFs were rendered and inspected (normal and multipage), text/page boundaries checked, and ZIP extraction independently verified. Tests use isolated data; no live payroll or employee records are changed. Real Supabase deployment, authenticated browser acceptance and actual email delivery still need the migration and deployment configuration above.
