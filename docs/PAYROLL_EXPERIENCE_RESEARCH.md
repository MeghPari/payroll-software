# Attendance and salary experience

## Research and decisions

Reviewed official product/help material for Zoho Payroll (India), greytHR and Gusto. These document their workflows; they do not establish one objectively best product. This research informs PayFlow's navigation and review flow, rather than changing its statutory calculation rules.

| Product evidence | Useful pattern | PayFlow implementation |
| --- | --- | --- |
| [Zoho pay runs](https://www.zoho.com/in/payroll/help/employer/pay-runs/) exposes payroll cost, net pay, deductions and employee summaries, with individual details, approval and bank advice. | A month should be understandable before payment. | Monthly Payroll Home, compact employee salary table, full breakdown on selection and clear approval/lock actions. |
| [Zoho Home](https://www.zoho.com/in/payroll/help/employer/basics/dashboard.html) gives access to payroll work from the home screen. | Put the main job on the landing page. | Payroll users land on Attendance & Salaries, with the next action derived from saved workflow state. |
| [greytHR payroll process](https://www.greythr.com/blog/payroll-process-on-greythr-experience-the-difference/) describes input preparation, checklist processing, verification, bank outputs and payslip publication. | Show preparation and completion in a short sequence. | Attendance, calculation, review/lock and salary payments replace the eleven-part overview. Advanced adjustments load on demand. |
| [Gusto run payroll](https://gusto.com/product/how-gusto-works) starts with the period, then inputs and a review summary. | Keep the period consistent through the journey. | Attendance, salary calculation, payments and payslips share the top-bar month selector. |
| [Gusto review alerts](https://support.gusto.com/article/260112145935220/review-changes-to-your-regular-payroll-with-helpful-alerts-for-admins) explains issues and directs users back to review their inputs. | Errors should point to something the user can inspect. | Incomplete attendance filter and employee date editor; payroll check failures expand for review. Historical anomaly detection is not implemented in this pass. |
| [Zoho attendance management](https://www.zoho.com/in/payroll/help/employer/leave-and-attendance/manage-attendance.html) describes reviewed shifts and regularization of missed punches. | Make correction discoverable without losing its history. | Each employee's monthly dates open the existing audited attendance entry/correction dialog; future dates are marked upcoming and cannot be entered here. |

## User journey

1. Select the company and month on Payroll Home.
2. Open Attendance. Review incomplete employee registers, select an employee's dates, record actual statuses or upload attendance, and apply reviewed nonworking dates where appropriate. Daily entry remains a separate tab.
3. Finalize complete attendance, then Calculate Salaries. Review payable days, loss-of-pay days, payable earnings, deductions and take-home salary. Select an employee for the captured breakdown. Overtime, bonuses and prior-month corrections are available on demand.
4. Approve reviewed salaries, then lock payroll. Approval and locking remain distinct authorized actions.
5. Open Salary Payments. Post the locked payroll entry directly from that screen using the existing versioned RPC, select the funding bank, prepare/download instructions, perform the transfer through the bank and record confirmed payment evidence.
6. Review recorded paid and remaining amounts and publish payslips.

The software does not execute bank transfers. Exported instructions and confirmed payment records have different meanings. No attendance is assumed present, and no approval or financial posting occurs automatically.

## Loading and access

The salary screen now loads employees and one payroll result rather than fetching that result repeatedly for review, period and eligibility. Validation is an explicit action; the calculation and approval RPCs retain their authoritative checks. The selected employee breakdown reuses the loaded snapshot. Corrections/adjustments mount when opened. Other navigation groups are collapsed until needed; all existing modules remain reachable.

This is a reduction in request count, not a measured claim of faster network latency. Provider latency and region placement still need measurement. The in-memory month resets on a full reload; it remains consistent while navigating. Normal JWT, membership, role permissions, RLS, optimistic versions, audit, exact rounding and protected financial history remain in force. No schema migration is required for this interface change.

Browser visual and authenticated journey acceptance remain separate from build, fixture and HTTP checks.

## 16 October 2026 review: client handover and saved salary review

This pass revisited official documentation rather than treating feature lists as proof of calculation correctness.

| Source | Finding | Decision for PayFlow |
| --- | --- | --- |
| [Zoho India pay runs](https://www.zoho.com/in/payroll/help/employer/pay-runs/) | Payroll separates input review, calculation, approval, payment and later corrections. | Keep the short monthly sequence and protected financial history. Optional bank setup affects calculation warnings; verified bank instructions remain a payment prerequisite. |
| [Gusto payroll review alerts](https://support.gusto.com/article/260112145935220/review-changes-to-your-regular-payroll-with-helpful-alerts-for-admins) | Historical comparisons identify changes for manual review; alerts do not change or submit payroll. | Add an on-demand previous-month comparison using saved salaries and payable days. PayFlow flags changes of at least INR 1,000 and 20%, or movement to/from zero. This is our transparent review rule, not Gusto's algorithm. No baseline means no inferred anomaly. |
| [greytHR attendance processing](https://www.greythr.com/greythr-help/admin/answers/122759105/) | Attendance records feed payroll and require review. | Fix the employee-profile daily rows, which still read a legacy local store. The rows and summary now derive from the same saved attendance query. Missing data is not assumed present or absent. |
| [Zoho users and roles](https://www.zoho.com/in/payroll/help/employer/settings/users-and-roles.html) | Named users with limited roles are more manageable than technical account identifiers. | Assign confirmed accounts by email and show names/emails only to company user administrators. In-app invitation delivery is not implemented. |
| [Supabase users](https://supabase.com/docs/guides/auth/users) and [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) | User creation/invitation and application membership are distinct. Default SMTP is restricted and unsuitable for general client delivery. | Retain individual verified accounts and explicit membership. Document dashboard account creation/invitation and custom SMTP for recovery/invites; do not expose an admin secret or invent successful email delivery. |
| [Vercel function regions](https://vercel.com/docs/functions/configuring-functions/region) | Distance between functions and the database adds latency. | Document region alignment after confirming the actual Supabase region. Do not guess a region or migrate client data. |
| [Supabase query optimization](https://supabase.com/docs/guides/database/query-optimization) | Indexes and query plans should guide database tuning. | Existing employee/date/salary-resolution indexes are present. Remove redundant application reads first; no speculative indexes without live query measurements. |

### Changes completed

- Saved bank/statutory warnings remain visible on Payroll Home, salary review, employee breakdown and payslip views/PDFs. Unknown statutory setup clearly marks net pay provisional without blocking calculation.
- New snapshots capture warnings for their employee only. Legacy payslip API responses are filtered to the employee, without rewriting locked/published financial records.
- Partially specified statutory flags still enforce explicitly applicable reviewed rules. Unknown flags remain unknown. The configuration form is retained.
- Daily attendance uses one register request and the already loaded employee list, instead of two register requests plus another employee request. Date-switch responses are guarded against late arrivals, and load failures offer retry rather than presenting everyone as unmarked.
- Calculation/approval/locking refresh the saved payroll once, retaining the employee list. Independent payroll GET reads run concurrently. Advanced salary panels are split into on-demand bundles.
- Salary Structures reuses already loaded revision profiles instead of fetching salary separately for every employee. Live components import reference options from a data-only module, avoiding initialization of the legacy seeded store.
- Company administrators can assign confirmed accounts by email and see member names. Normal JWT/RLS authorization and audited membership changes remain enforced; no Auth admin key is required for assignment. Permission is checked again after the membership lock.

### Acceptance limits

Automated fixtures verify arithmetic, permissions and workflow behavior, not a signed-in production journey. The browser connector could not initialize in this session. The generated provisional payslip was rendered and inspected locally. Live latency, client SMTP delivery, Storage operations, backup restoration and concurrent multi-user acceptance still need the configured hosted services. Annual statutory models, automatic government filing, bank execution and full-and-final settlement remain separate implementation work; they are not implied by this UX pass.
