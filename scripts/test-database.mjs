import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
const database = new PGlite();
try {
  await database.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema auth to authenticated,anon,service_role;
    -- Storage metadata fixture: exercises SQL bucket/policies, not the Storage service.
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
  `);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  // Historical tests below cover 001-048; current dataset behavior is tested
  // separately by test-employee-dataset.mjs on both supported upgrade paths.
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.sql')&&!name.includes('employee_dataset_salaries')&&!name.includes('clear_month_attendance')&&!name.includes('reset_attendance_payroll_month')&&!name.includes('manual_salary_optional_imports_kyc')&&!name.includes('incremental_employee_payroll')&&!name.includes('payroll_batch_editing')&&!name.includes('payroll_readiness_reasons')).sort()) {
    let source = await readFile(new URL(name, directory), 'utf8');
    // PGlite lacks pgcrypto. PostgreSQL's built-in gen_random_uuid is available;
    // no cryptographic pgcrypto functions are used by these migrations.
    source = source.replace('create extension if not exists pgcrypto;', '-- pgcrypto extension installation omitted only in PGlite test');
    await database.exec(source);
    console.log(`PASS migration ${name}`);
  }
  await database.exec(await readFile(new URL('../supabase/tests/tenant_isolation.sql', import.meta.url), 'utf8'));
  console.log('PASS tenant visibility, forbidden cross-company writes, employee creation, duplicate prevention, stale versions, forbidden audit forging/deletion, atomic audit');
  await database.exec(await readFile(new URL('../supabase/tests/hr_workflows.sql', import.meta.url), 'utf8'));
  console.log('PASS effective salary history, exact amounts, import rollback, attendance completeness/finalization/correction, leave balances/approval/overlap/overdraw invariants');
  await database.exec(await readFile(new URL('../supabase/tests/department_designations.sql',import.meta.url),'utf8'));
  console.log('PASS department role hierarchy, exact designation payroll, mismatch rollback and custom preservation');
  await database.exec(await readFile(new URL('../supabase/tests/designation_salaries.sql',import.meta.url),'utf8'));
  console.log('PASS designation defaults, automatic onboarding/role revisions, custom overrides, CSV precedence, HR permissions, private assignment denial, P/A storage and exact role payroll');
  await database.exec(await readFile(new URL('../supabase/tests/salary_all_months.sql',import.meta.url),'utf8'));
  console.log('PASS first salary assigned September calculates July/August, carries forward and preserves exact mid-month revision; bank/statutory setup stays optional');
  await database.exec(await readFile(new URL('../supabase/tests/optional_payroll_setup.sql', import.meta.url), 'utf8'));
  console.log('PASS optional bank/statutory setup: two months calculated, exact net, persisted warnings, no invented employee setup');
  await database.exec(await readFile(new URL('../supabase/tests/client_review.sql',import.meta.url),'utf8'));
  console.log('PASS account email assignment, confirmed-user/admin restrictions, member visibility and explicitly applicable deductions with partially unset flags');
  await database.exec(await readFile(new URL('../supabase/tests/attendance_new_employees.sql',import.meta.url),'utf8'));
  console.log('PASS unknown attendance employee onboarding, exact dates/counters, no invented salary/bank, permission denial and atomic rollback');
  await database.exec(await readFile(new URL('../supabase/tests/client_templates.sql',import.meta.url),'utf8'));
  console.log('PASS client employee template: mononyms/blank email/counters/private IDs/manager/DA imports, rollback and new monthly recoveries with balanced posting; reviewed client costs leave net unchanged');
  await database.exec(await readFile(new URL('../supabase/tests/payroll_workflows.sql', import.meta.url), 'utf8'));
  console.log('PASS payroll segmentation, exact rounding, duplicate runs, stale input/version rejection, approval and lock transitions, attendance correction protection');
  await database.exec(await readFile(new URL('../supabase/tests/accounting_workflows.sql', import.meta.url), 'utf8'));
  console.log('PASS open financial years, balanced journal posting, duplicate rejection, ledger totals and reversal invariants');
  await database.exec(await readFile(new URL('../supabase/tests/invoice_workflows.sql', import.meta.url), 'utf8'));
  console.log('PASS invoice snapshots and exact tax totals, fiscal-year posting, duplicate prevention, partial/full receipts, overpayment denial and atomic receipt journals');
  await database.exec(await readFile(new URL('../supabase/tests/disbursement_workflows.sql', import.meta.url), 'utf8'));
  console.log('PASS payroll accrual prerequisite, verified immutable bank instructions, partial/full salary evidence, duplicate/excess payment denial, reversal/cancellation and tenant access');
  await database.exec(await readFile(new URL('../supabase/tests/documents_profiles.sql',import.meta.url),'utf8'));
  console.log('PASS private upload reservations, Storage policy fixture, missing-object denial, employee-only downloads, review/version protection, removal and personal-profile edits');
  await database.exec(await readFile(new URL('../supabase/tests/administration_workflows.sql',import.meta.url),'utf8'));
  console.log('PASS persisted announcements and archived visibility, own/admin ticket threads, tenant/version denial and actual compliance evidence/corrections');
  await database.exec(await readFile(new URL('../supabase/tests/company_calendar.sql',import.meta.url),'utf8'));
  console.log('PASS versioned company/settings, manager cycle protection, reviewed employment-scoped holidays/weekly offs, no overwrites, shift snapshots and calendar retirement');
  await database.exec(await readFile(new URL('../supabase/tests/payroll_adjustments.sql',import.meta.url),'utf8'));
  console.log('PASS reviewed overtime/arrears/reimbursements/bonus/recoveries, exact round-down amounts, immutable adjustment snapshots, duplicate/stale/approved protection and negative-net rollback');
  await database.exec(await readFile(new URL('../supabase/tests/accounting_corrections.sql',import.meta.url),'utf8'));
  console.log('PASS journal draft edits/rollback/cancellation, posted immutability, closed-month/year posting denial, stale period protection and audited reopening');
  await database.exec(await readFile(new URL('../supabase/tests/bank_reconciliation.sql',import.meta.url),'utf8'));
  console.log('PASS signed statement balances, atomic import rollback, posted-entry matching, duplicate clearing denial, stale versions, review/reopening and changed-book detection');
  await database.exec(await readFile(new URL('../supabase/tests/request_limits.sql',import.meta.url),'utf8'));
  console.log('PASS shared per-user request limits, tenant denial, private counters, separate buckets and expired-window reset');
  await database.exec(await readFile(new URL('../supabase/tests/working_day_payroll.sql',import.meta.url),'utf8'));
  console.log('PASS working-day coverage, reviewed holidays, mid-month salary segmentation, exact paise, captured basis and stale calendar protection');
  await database.exec(await readFile(new URL('../supabase/tests/prior_payroll_corrections.sql',import.meta.url),'utf8'));
  console.log('PASS prior published payroll corrections, captured source, duplicate/stale/tenant protection, later exact payroll and unchanged published originals');
  await database.exec(await readFile(new URL('../supabase/tests/cash_flow_reviews.sql',import.meta.url),'utf8'));
  console.log('PASS exact reviewed cash allocations, stale/duplicate/tenant denial, immutable history and zero-net internal-transfer exclusion');
  console.log('Auth schema/uid are fixtures. This does not verify Supabase Auth, REST grants, Storage, or live sessions.');
} catch (error) {
  console.error('Database test failed', { message: error.message, code: error.code, position:error.position, internalPosition:error.internalPosition, internalQuery:error.internalQuery, where: error.where });
  process.exitCode = 1;
} finally { await database.close(); }
