-- Apply once after 044. First salary covers earlier employed dates too.
-- Later revisions retain their dates. No saved payroll/history is rewritten.
begin;
create function public.salary_assignment_at(c uuid,e uuid,d date)returns uuid
language sql stable set search_path=''as $$
 select a.id from public.employee_salary_assignments a where a.company_id=c and a.employee_id=e
 order by (a.effective_from<=d)desc,
 case when a.effective_from<=d then a.effective_from end desc,a.effective_from,a.id limit 1
$$;
revoke all on function public.salary_assignment_at(uuid,uuid,date)from public,anon,authenticated;
grant execute on function public.salary_assignment_at(uuid,uuid,date)to authenticated;
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.validate_payroll_internal(uuid,date)'::regprocedure);
 changed:=replace(definition,'a.employee_id=emp.id and a.effective_from<=d::date','a.employee_id=emp.id');
 if changed=definition then raise exception 'Unexpected salary coverage validation definition';end if;
 changed:=replace(changed,'Salary must cover every employment day.','Assign a salary once; it covers all months of employment until revised.');execute changed;
 definition:=pg_get_functiondef('public.calculate_payroll(uuid,date)'::regprocedure);
 changed:=replace(definition,'select a.id from public.employee_salary_assignments a where a.company_id=c and a.employee_id=emp.id and a.effective_from<=d::date order by a.effective_from desc limit 1','select public.salary_assignment_at(c,emp.id,d::date) id');
 if changed=definition then raise exception 'Unexpected salary day resolution definition';end if;
 definition:=changed;
 changed:=replace(definition,'select id from public.employee_salary_assignments where company_id=c and employee_id=emp.id and effective_from<=least(finish,coalesce(emp.exit_date,finish))order by effective_from desc limit 1','select public.salary_assignment_at(c,emp.id,least(finish,coalesce(emp.exit_date,finish)))');
 if changed=definition then raise exception 'Unexpected salary snapshot definition';end if;
 changed:=replace(changed,'''exact-proration-v2''','''exact-proration-v3-salary-carry''');execute changed;
 definition:=pg_get_functiondef('public.protect_payroll_calculation_method()'::regprocedure);
 changed:=replace(definition,'''exact-proration-v2''','''exact-proration-v3-salary-carry''');
 if changed=definition then raise exception 'Unexpected payroll calculation guard';end if;execute changed;
end $$;
commit;
