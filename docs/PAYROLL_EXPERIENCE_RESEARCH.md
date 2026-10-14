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
