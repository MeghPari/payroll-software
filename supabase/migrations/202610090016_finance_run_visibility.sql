begin;
create policy finance_locked_run_read on public.payroll_runs for select to authenticated using(status='Locked'and public.has_permission(company_id,'accounting.read'));
commit;
