-- Apply after upgrade-payroll-batch-editing.sql. No saved payroll is changed.
begin;
create or replace function public.validate_payroll(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$
declare checks jsonb;issues jsonb;ready uuid[];blockers integer;begin
 perform public.require_permission(c,'payroll.run');
 if m is null or extract(day from m)<>1 then raise exception 'First day required'using errcode='22023';end if;
 checks:=public.validate_payroll_before_batches(c,m);
 select coalesce(jsonb_agg(case when issue->>'employeeId'<>''then issue||jsonb_build_object('severity','Warning','message',case when issue->>'check'='Attendance Missing'then 'Pending: complete attendance for this employee for the whole employment period in this month.'else issue->>'message'end)else issue end),'[]')into issues
 from jsonb_array_elements(checks->'issues')issue where issue->>'check'<>'Attendance Finalization'and not exists(select 1 from public.payroll_run_employees p where p.company_id=c and p.payroll_month=m and p.employee_id::text=issue->>'employeeId');
 select coalesce(array_agg(e.id),'{}')into ready from public.employees e where e.company_id=c and e.status not in('Inactive','Salary Hold')and public.employee_attendance_complete(c,e.id,m)
 and not exists(select 1 from public.payroll_run_employees p where p.company_id=c and p.payroll_month=m and p.employee_id=e.id)
 and not exists(select 1 from jsonb_array_elements(checks->'issues')i where i->>'employeeId'=e.id::text and i->>'severity'='Blocking Error'and i->>'check'<>'Attendance Missing');
 select count(*)into blockers from jsonb_array_elements(issues)i where i->>'severity'='Blocking Error';
 return checks||jsonb_build_object('pendingReasons',(select coalesce(jsonb_agg(i),'[]'::jsonb) from jsonb_array_elements(checks->'issues')i join public.employees e on e.id::text=i->>'employeeId' and e.company_id=c where i->>'severity'='Blocking Error' and e.joining_date<m+interval '1 month' and(e.exit_date is null or e.exit_date>=m)and e.status not in('Inactive','Salary Hold')and not exists(select 1 from public.payroll_run_employees p where p.company_id=c and p.payroll_month=m and p.employee_id=e.id)),'issues',issues,'blockingErrors',blockers,'warnings',jsonb_array_length(issues)-blockers,'passed',cardinality(ready),'readyEmployeeIds',to_jsonb(ready),'readyCount',cardinality(ready),'calculatedCount',(select count(*)from public.payroll_run_employees where company_id=c and payroll_month=m));
end $$;
revoke all on function public.validate_payroll(uuid,date)from public,anon,authenticated,service_role;
grant execute on function public.validate_payroll(uuid,date)to authenticated;
notify pgrst,'reload schema';
commit;
