# Payroll calculation behavior

Money uses safe integer paise. The database uses exact numeric intermediates and rounds each summed component to paise. The database engine supports calendar-day or reviewed working-day proration and half-up or down rounding. Unsupported configuration is rejected. Working-day support requires migration 035.

Payroll requires finalized complete attendance across each eligible employee's joining-to-exit window. Weekly offs and holidays need explicit records; Missing Punch remains incomplete. Effective salary revisions are selected per employment date. Prorated earnings use the calendar-month denominator and paid attendance; Half Day contributes one half. Nonprorated components follow explicit component rules.

All PF/ESI/PT/TDS applicability flags must be configured. Applicable contributions require an effective reviewed rule covering the month with wage components, employee/employer basis points, optional wage cap and fixed employee amount. State-specific configuration takes precedence. No universal statutory rate is supplied. Mid-month rule changes are blocked pending reviewed segmented calculation.

Runs persist captured identity, salary, attendance, amounts and rule references. Financial-input revisions invalidate stale approval. Approval requires validation; locking protects inputs. Negative net pay is rejected. Published payslips or posted journals prevent ordinary unlock.

Annual taxable-income/TDS slabs, complete state PT schedules and full-and-final models remain incomplete. Overtime, arrears, reimbursement, bonus and recoveries use explicitly reviewed period adjustments. Flat reviewed contribution configuration is not a complete statutory compliance engine. Tests use illustrative values, not legal-rate assertions.

## Working-day basis

The denominator is the full month of reviewed working dates, after reviewed holidays and weekly offs. A schedule must cover every date, including dates before joining or after exit. Employee-specific schedules override company schedules. Prorated earnings use paid working-date weights inside the joining-to-exit window and the salary version effective on each date; Half Day contributes 0.5. Work on nonworking dates requires separately reviewed overtime rather than silently adding regular salary days. Weekly Off/Holiday records that conflict with a working date block validation.

Snapshots retain proration mode, denominator, weighted paid days, schedule/holiday basis and exact component amounts. Calendar edits invalidate stale approval but do not rewrite existing snapshots or published payslips. Calendar mode retains paid weekly offs and holidays.

## Exact half-paise boundaries and prior-payroll corrections

Migration 039 accumulates weighted integer-paise numerators across salary segments before division by the month denominator and rounding. This fixes recurring-division drift at exact half-paise boundaries. For example, 100003 paise over half the working month yields 50001.5 paise: half-up gives 50002 and down gives 50001. The equivalent calendar half-month case also rounds correctly. Unapproved calculations made before this method must be recalculated before approval; published/locked records are retained.

Prior published/posted payroll can be corrected with a reviewed positive arrears or recovery amount in a later unapproved payroll month where the employee remains eligible. Source run/version and financial figures are captured by the server. The target payroll applies its configured contribution rules and requires normal recalculation, validation, approval and locking. It does not rewrite historical payslips or execute a refund. Exited employees need a separate settlement workflow.
