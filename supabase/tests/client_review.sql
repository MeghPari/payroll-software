begin;
insert into auth.users(id,email,email_confirmed_at)values('20000000-0000-4000-8000-000000000001','payroll@example.invalid',now());
insert into public.user_profiles(id)values('20000000-0000-4000-8000-000000000001');
insert into public.companies(id,name)values('20000000-0000-4000-8000-000000000011','Payroll fixture');
insert into public.user_company_roles(company_id,user_id,role)values('20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000001','Super Admin');
insert into public.employees(id,company_id,employee_code,first_name,last_name,email,joining_date)values('20000000-0000-4000-8000-000000000021','20000000-0000-4000-8000-000000000011','PAY','Payroll','Fixture','employee@example.invalid','2026-01-01');
insert into auth.users(id,email,email_confirmed_at)values('20000000-0000-4000-8000-000000000002','client@example.invalid',now()),('20000000-0000-4000-8000-000000000003','unconfirmed@example.invalid',null);
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
perform public.set_company_member_by_email(c,' CLIENT@example.invalid ','Payroll Admin',true);
 if (select count(*)from public.list_company_members(c))<>2 then raise exception 'FAIL member list';end if;
 if (select email from public.list_company_members(c) where user_id='20000000-0000-4000-8000-000000000002')<>'client@example.invalid' then raise exception 'FAIL member email';end if;
 begin perform public.set_company_member_by_email(c,'unconfirmed@example.invalid','Employee',true);raise exception 'FAIL unconfirmed member';exception when no_data_found then null;end;
 begin perform public.set_company_member_by_email(c,'payroll@example.invalid','Employee',true);raise exception 'FAIL self change';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
 begin perform public.list_company_members(c);raise exception 'FAIL nonadmin list';exception when insufficient_privilege then null;end;
 begin perform public.set_company_member_by_email(c,'payroll@example.invalid','Employee',false);raise exception 'FAIL nonadmin edit';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
end $$;
reset role;
insert into public.employee_statutory_details(company_id,employee_id,uan,pf_applicable) values('20000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000021','100000000001',true);
set local role authenticated;
do $$declare c uuid:='20000000-0000-4000-8000-000000000011';checks jsonb;r uuid;begin
 checks:=public.validate_payroll(c,'2026-10-01');
 if not exists(select 1 from jsonb_array_elements(checks->'issues')issue where issue->>'check'='Reviewed Rule Required' and issue->>'severity'='Blocking Error')then raise exception 'FAIL partial flag bypassed rule validation';end if;
 perform public.save_statutory_rule(c,'{"code":"pf","effectiveFrom":"2026-09-01","effectiveTo":"2026-12-31","wageComponents":["basic"],"employeeBasisPoints":1200,"verificationReference":"Fixture reviewed rule"}');
 r:=public.calculate_payroll(c,'2026-10-01');
 if(select net_minor from public.payroll_run_employees where run_id=r)<>6160000 then raise exception 'FAIL explicitly applicable deduction not applied';end if;
 if(select jsonb_array_length(snapshot->'setupWarnings')from public.payroll_run_employees where run_id=r)<>2 then raise exception 'FAIL unknown flags warning lost';end if;
end $$;
reset role;
insert into public.employees(id,company_id,employee_code,first_name,last_name,email,joining_date)values('20000000-0000-4000-8000-000000000022','20000000-0000-4000-8000-000000000011','OTHER','Second','Employee','second@example.invalid','2026-10-01');
set local role authenticated;
do $$declare c uuid:='20000000-0000-4000-8000-000000000011';e uuid:='20000000-0000-4000-8000-000000000022';s uuid;r uuid;batch jsonb;begin
 select id into s from public.salary_structures where company_id=c limit 1;
 perform public.assign_salary(c,e,s,'2026-10-01','{"basic":8000000}');
 perform public.finalize_attendance(c,'2026-10-01',true,'Fixture roster addition');
 select jsonb_agg(jsonb_build_object('employeeId',e,'date',d::date,'status','Present'))into batch from generate_series('2026-10-01'::date,'2026-10-31'::date,interval '1 day')d;
 perform public.save_attendance(c,batch,'Fixture roster');perform public.finalize_attendance(c,'2026-10-01');
 r:=public.calculate_payroll(c,'2026-10-01');
 if exists(select 1 from public.payroll_run_employees p cross join lateral jsonb_array_elements(p.snapshot->'setupWarnings')issue where p.run_id=r and issue->>'employeeId'<>p.employee_id::text)then raise exception 'FAIL another employee warning captured';end if;
 if exists(select 1 from public.payroll_run_employees p where p.run_id=r and jsonb_array_length(p.snapshot->'setupWarnings')<>2)then raise exception 'FAIL warning scope count';end if;
end $$;
rollback;
