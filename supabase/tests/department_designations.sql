begin;
insert into auth.users(id,email,email_confirmed_at)values('48000000-0000-4000-8000-000000000001','departments@example.invalid',now());
insert into public.user_profiles(id)values('48000000-0000-4000-8000-000000000001');
insert into public.companies(id,name)values('48000000-0000-4000-8000-000000000011','Department fixture');
insert into public.user_company_roles(company_id,user_id,role)values('48000000-0000-4000-8000-000000000011','48000000-0000-4000-8000-000000000001','Super Admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','48000000-0000-4000-8000-000000000001',true);
do $$declare c uuid:='48000000-0000-4000-8000-000000000011';e uuid;a uuid;r uuid;batch jsonb;begin
 e:=public.save_employee(c,'{"employeeCode":"DEV1","firstName":"Developer","lastName":"Fixture","email":"","joiningDate":"2026-05-01","designation":"Software Developer","department":"IT"}');
 if(select count(*)from public.list_department_designations(c)where department='IT')<>2 then raise exception 'FAIL IT roles';end if;
 if(select sum(v.amount_minor)from public.employee_salary_assignments s join public.employee_salary_component_values v on v.assignment_id=s.id and v.company_id=c where s.employee_id=e and s.company_id=c)<>7000000 then raise exception 'FAIL developer default salary';end if;
 a:=public.save_employee(c,'{"employeeCode":"ACC1","firstName":"Accountant","lastName":"Fixture","email":"","joiningDate":"2026-05-01","designation":"Accountant"}');
 if(select d.name from public.employees e join public.departments d on d.id=e.department_id and d.company_id=c where e.id=a)<>'Finance'then raise exception 'FAIL inferred department';end if;
 begin
 perform public.save_employee(c,'{"employeeCode":"BAD1","firstName":"Mismatch","lastName":"Fixture","email":"","joiningDate":"2026-05-01","designation":"Accountant","department":"IT"}');
 raise exception 'FAIL mismatched role accepted';exception when sqlstate 'P0048'then null;end;
 if exists(select 1 from public.employees where company_id=c and employee_code='BAD1')then raise exception 'FAIL mismatch rollback';end if;
 select jsonb_agg(jsonb_build_object('employeeId',id,'date',day::date,'status','P','workHours',0,'overtime',0,'checkIn',null,'checkOut',null,'remarks','department fixture'))into batch from public.employees cross join generate_series('2026-05-01'::date,'2026-05-31'::date,'1 day')day where company_id=c;
 perform public.save_attendance(c,batch,'Department fixture',false);
 perform public.finalize_attendance(c,'2026-05-01');
 r:=public.calculate_payroll(c,'2026-05-01');
 if not exists(select 1 from public.payroll_run_employees where run_id=r and employee_id=e and gross_minor=7000000 and net_minor=7000000)then raise exception 'FAIL developer designation payroll';end if;
 if not exists(select 1 from public.payroll_run_employees where run_id=r and employee_id=a and gross_minor=5000000 and net_minor=5000000)then raise exception 'FAIL accountant designation payroll';end if;
end $$;
rollback;
