begin;
insert into auth.users(id,email,email_confirmed_at)values('20000000-0000-4000-8000-000000000001','payroll@example.invalid',now());
insert into public.user_profiles(id)values('20000000-0000-4000-8000-000000000001');
insert into public.companies(id,name)values('20000000-0000-4000-8000-000000000011','Payroll fixture');
insert into public.user_company_roles(company_id,user_id,role)values('20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','Super Admin');
insert into public.employees(id,company_id,employee_code,first_name,last_name,email,joining_date)values('20000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000011','PAY','Payroll','Fixture','employee@example.invalid','2026-01-01');
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);

do $$declare c uuid:='20000000-0000-4000-8000-000000000011';e uuid:='20000000-0000-4000-8000-000000000021';s uuid;r uuid;batch jsonb;checks jsonb;begin
 s:=public.save_salary_structure(c,'{"name":"Optional setup fixture","status":"Active","components":[{"code":"basic"}]}');
 perform public.assign_salary(c,e,s,'2026-09-01','{"basic":7000000}');
 for month_index in 9..10 loop
 select jsonb_agg(jsonb_build_object('employeeId',e,'date',d::date,'status','Present'))into batch from generate_series(make_date(2026,month_index,1),(make_date(2026,month_index,1)+interval '1 month - 1 day')::date,interval '1 day')d;
 perform public.save_attendance(c,batch,'Fixture');perform public.finalize_attendance(c,make_date(2026,month_index,1));
 checks:=public.validate_payroll(c,make_date(2026,month_index,1));
 if (checks->>'blockingErrors')::int<>0 or (checks->>'warnings')::int<>2 then raise exception 'FAIL optional setup validation %',checks;end if;
 r:=public.calculate_payroll(c,make_date(2026,month_index,1));
 if (select net_minor from public.payroll_run_employees where run_id=r and employee_id=e)<>7000000 then raise exception 'FAIL calculated net';end if;
 if (select jsonb_array_length(snapshot->'setupWarnings') from public.payroll_run_employees where run_id=r and employee_id=e)<>2 then raise exception 'FAIL warnings snapshot';end if;
 end loop;
 if exists(select 1 from public.employee_bank_details where company_id=c) or exists(select 1 from public.employee_statutory_details where company_id=c)then raise exception 'FAIL invented setup';end if;
end $$;
rollback;
