# Database schema and migration status

The user confirmed migrations 001-040 applied live, including upgrade-payroll-finance.sql. Do not rerun the applied packages. All 40 execute in embedded PostgreSQL with fixture Auth/Storage; this is not independent live provider verification. Earlier applied packages are frozen.

## Schema groups

- 001?003: companies, profiles, preset roles/permissions/memberships, settings, departments/designations, core/private/bank/statutory employee details, lifecycle history, employee/import/bulk RPCs and transactional audit.
- 004?008: salary structures/components/assignments, salary holds, KYC verification, daily attendance/finalization/import batches, leave policies/balances/requests and authorized decisions.
- 009?012: reviewed effective statutory settings, versioned payroll runs, employee/component snapshots, approvals/lock history and financial-input consistency protections.
- 013: captured generated/published payslips and downstream lock protection.
- 014?016: account groups/ledgers, financial years, immutable posted journals/lines, reversals, mapped unique payroll accrual and Finance visibility.
- 017?018: exit-date validation, salary imports and company-first lock ordering.
- 019: business parties, bank accounts, invoice/items, bank transactions and invoice payment links; atomic source posting/correction RPCs.
- 020: captured payroll posting mappings, disbursement instruction batches/items/payment links, verification reset triggers and private bank-instruction RPC.

Company-qualified keys prevent cross-tenant references. Table writes are revoked from ordinary clients; permission-checking security-definer RPCs with empty search_path perform mutations/audit atomically. Sensitive employee tables have separate visibility. Anonymous access is denied. Payment instructions have no direct select grants; their RPC returns masked fields unless an authorized export explicitly requests bank details.

Migration 020 does not backfill payroll posting mappings for historical accruals. Those need a reviewed historical workflow before payout preparation. Existing-company preservation is tested for both additive packages. Packages are one-time SQL Editor scripts, not idempotent operations.

## Additional schema groups

- 021: employee_documents with private Storage reservations/policies and broader personal fields.
- 022-024: announcements, support tickets/messages, compliance obligations, reviewed GST credits and own-user notifications.
- 025-026: versioned company/settings, reviewed work schedules/holidays and exact reviewed monthly payroll adjustments.
- 027-028: accounting periods, journal corrections/year controls and immutable bank statements/matches.
- 029-031: invoice company identity snapshots, private-download audit, confirmed employee account links and credit/debit notes.
- 032: immutable gst_credit_review_history and gst_book_reviews captured from authoritative posted events.
- 033: immutable salary_payment_attempts linked to batch/employee with unique retries and remaining-salary guards.
- 034: private application_request_limits counters and strengthened year-close guards.
- 035: reviewed working-calendar resolution, captured proration basis and calendar input-revision triggers. Existing payroll and payslip records are not rewritten.

See IMPLEMENTATION_PROGRESS.md and TEST_RESULTS.md for outstanding scope and provider verification limits.

- 036 adds protected source-run/version/figure links to payroll adjustments for later-month corrections.
- 037 adds cash_flow_reviews and immutable cash_flow_review_history with exact signed allocation checks.
- 038 permits actual salary transfer/failure dates within the payroll month while retaining future/pre-month denial.
- 039 adds payroll_calculation_methods provenance and approval protection for legacy unapproved runs; no existing financial records are rewritten.

- 040: authenticated session_context and atomic authorize_company_request RPCs; data RLS and business RPC authorization remain independent.
