begin;
insert into auth.users(id,email,email_confirmed_at)values('45000000-0000-4000-8000-000000000001','payroll@example.invalid',now());
insert into public.user_profiles(id)values('45000000-0000-4000-8000-000000000001');
insert into public.companies(id,name)values('45000000-0000-4000-8000-000000000011','Payroll fixture');
insert into public.user_company_roles(company_id,user_id,role)values('45000000-0000-4000-8000-000000000011','45000000-0000-4000-8000-000000000001','Super Admin');
insert into public.employees(id,company_id,employee_code,first_name,last_name,email,joining_date)values('45000000-0000-4000-8000-000000000021','45000000-0000-4000-8000-000000000011','PAY','Payroll','Fixture','employee@example.invalid','2026-01-01');
set local role authenticated;
select set_config('request.jwt.claim.sub','45000000-0000-4000-8000-000000000001',true);

do $$declare c uuid:='45000000-0000-4000-8000-000000000011';e uuid:='45000000-0000-4000-8000-000000000021';s uuid;r uuid;batch jsonb;checks jsonb;begin
 s:=public.save_salary_structure(c,'{"name":"All months salary fixture","status":"Active","components":[{"code":"basic"}]}');
 perform public.assign_salary(c,e,s,'2026-09-01','{"basic":7000000}');
 perform public.assign_salary(c,e,s,'2026-10-16','{"basic":8000000}');
 for month_index in 7..10 loop
 select jsonb_agg(jsonb_build_object('employeeId',e,'date',d::date,'status','Present'))into batch from generate_series(make_date(2026,month_index,1),(make_date(2026,month_index,1)+interval '1 month - 1 day')::date,interval '1 day')d;
 perform public.save_attendance(c,batch,'Fixture');perform public.finalize_attendance(c,make_date(2026,month_index,1));
 checks:=public.validate_payroll(c,make_date(2026,month_index,1));
 if (checks->>'blockingErrors')::int<>0 or (checks->>'warnings')::int<>2 then raise exception 'FAIL optional setup validation %',checks;end if;
 r:=public.calculate_payroll(c,make_date(2026,month_index,1));
 if (select net_minor from public.payroll_run_employees where run_id=r and employee_id=e)<>(case when month_index=10 then 7516129 else 7000000 end) then raise exception 'FAIL calculated net';end if;
 if (select jsonb_array_length(snapshot->'setupWarnings') from public.payroll_run_employees where run_id=r and employee_id=e)<>2 then raise exception 'FAIL warnings snapshot';end if;
 end loop;
 if public.salary_assignment_at(c,e,'2026-07-01')<>(select id from public.employee_salary_assignments where company_id=c and employee_id=e and effective_from='2026-09-01')then raise exception 'FAIL past baseline selection';end if;
 if public.salary_assignment_at(c,e,'2027-12-31')<>(select id from public.employee_salary_assignments where company_id=c and employee_id=e and effective_from='2026-10-16')then raise exception 'FAIL future revision carry';end if;
 if exists(select 1 from public.employee_bank_details where company_id=c) or exists(select 1 from public.employee_statutory_details where company_id=c)then raise exception 'FAIL invented setup';end if;
end $$;
rollback;
