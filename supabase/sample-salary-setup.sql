-- ONE-TIME sample inputs requested by the user for the two existing employees.
-- Run in the existing project's privileged Supabase SQL Editor.
-- Monthly GROSS: Adarsh INR 70,000; Harsh INR 80,000. NET depends on actual
-- attendance and reviewed deductions/statutory settings.
-- No bank details, statutory applicability, attendance or payments are created.
begin;
select set_config('request.jwt.claim.sub','df0c63ac-ce98-4430-bb6f-9e018fc4220d',true);
do $$
declare
 c uuid:='28007669-1a91-4d80-b409-447cfa66f12e';
 sid uuid; adarsh public.employees; harsh public.employees; components jsonb;
begin
 if not public.has_permission(c,'salary.write')then
  raise exception 'The configured operator lacks active salary-write access';
 end if;
 perform 1 from public.companies where id=c for update;
 select * into strict adarsh from public.employees where company_id=c and employee_code='EMP-CF5297CC' for update;
 select * into strict harsh from public.employees where company_id=c and employee_code='EMP-5A2A7495' for update;
 if lower(trim(adarsh.first_name||' '||adarsh.last_name))<>'adarsh mishra'
 or lower(trim(harsh.first_name||' '||harsh.last_name))<>'harsh swami' then
  raise exception 'Employee codes/names do not match the requested sample targets';
 end if;
 if exists(select 1 from public.employee_salary_assignments where company_id=c and employee_id in(adarsh.id,harsh.id))then
  raise exception 'Salary already assigned. Sample setup will not overwrite salary history';
 end if;
 if exists(select 1 from public.payroll_runs where company_id=c and month>='2026-09-01' and status in('Approved','Locked'))then
  raise exception 'Protected payroll exists. Use the reviewed salary/correction workflow';
 end if;
 select jsonb_agg(jsonb_build_object('code',code,'calculationType','As per record','valueMinor',null)) into components
 from unnest(array['basic','hra','special','conveyance','other','bonus','variable','loan','advance','otherDeduction','employerOther'])code;
 sid:=public.save_salary_structure(c,jsonb_build_object('name','Sample monthly salary - September 2026','status','Active','components',components));
 perform public.assign_salary(c,adarsh.id,sid,greatest('2026-09-01'::date,adarsh.joining_date),
  '{"basic":4000000,"hra":2000000,"special":1000000,"conveyance":0,"other":0,"bonus":0,"variable":0,"loan":0,"advance":0,"otherDeduction":0,"employerOther":0}',
  'User-requested SAMPLE: INR 70,000 monthly gross; replace with reviewed client salary before production payroll.');
 perform public.assign_salary(c,harsh.id,sid,greatest('2026-09-01'::date,harsh.joining_date),
  '{"basic":4500000,"hra":2250000,"special":1250000,"conveyance":0,"other":0,"bonus":0,"variable":0,"loan":0,"advance":0,"otherDeduction":0,"employerOther":0}',
  'User-requested SAMPLE: INR 80,000 monthly gross; replace with reviewed client salary before production payroll.');
end $$;
commit;
