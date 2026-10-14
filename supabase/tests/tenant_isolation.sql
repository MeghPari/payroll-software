-- Integration test only: run against a disposable Supabase project after migrations.
-- The transaction rolls back all fixtures. Requires the postgres/operator role.
begin;
insert into auth.users(id,email,email_confirmed_at)
values ('00000000-0000-4000-8000-000000000001','test-a@example.invalid',now()),
       ('00000000-0000-4000-8000-000000000002','test-b@example.invalid',now());
insert into public.user_profiles(id) values
 ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.companies(id,name) values
 ('00000000-0000-4000-8000-000000000011','Isolation A'),('00000000-0000-4000-8000-000000000012','Isolation B');
insert into public.user_company_roles(company_id,user_id,role) values
 ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','HR Admin'),
 ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002','Super Admin');
insert into public.employees(company_id,employee_code,first_name,last_name,email,joining_date) values
 ('00000000-0000-4000-8000-000000000011','A1','Tenant','A','a@example.invalid','2026-01-01'),
 ('00000000-0000-4000-8000-000000000012','B1','Tenant','B','b@example.invalid','2026-01-01');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare count_rows integer; employee_uuid uuid;
begin
 select count(*) into count_rows from public.employees;
 if count_rows<>1 then raise exception 'FAIL: cross-tenant employee read'; end if;
 if public.has_permission('00000000-0000-4000-8000-000000000012','employees.write') then raise exception 'FAIL: cross-tenant permission'; end if;
 begin
  perform public.save_employee('00000000-0000-4000-8000-000000000012','{"firstName":"Intruder","lastName":"Test","email":"x@example.invalid","joiningDate":"2026-01-01"}');
  raise exception 'FAIL: cross-tenant write accepted';
 exception when insufficient_privilege then null;
 end;
 employee_uuid := public.save_employee('00000000-0000-4000-8000-000000000011','{"employeeCode":"A2","firstName":"Created","lastName":"Test","email":"created@example.invalid","joiningDate":"2026-01-01"}');
 if employee_uuid is null then raise exception 'FAIL: employee insert'; end if;
 begin
  perform public.save_employee('00000000-0000-4000-8000-000000000011','{"employeeCode":"A2","firstName":"Duplicate","lastName":"Test","email":"duplicate@example.invalid","joiningDate":"2026-01-01"}');
  raise exception 'FAIL: duplicate employee code accepted';
 exception when unique_violation then null;
 end;
 begin
  perform public.save_employee('00000000-0000-4000-8000-000000000011','{"firstName":"Stale","lastName":"Test","email":"stale@example.invalid","joiningDate":"2026-01-01"}',employee_uuid,99);
  raise exception 'FAIL: stale version accepted';
 exception when serialization_failure then null;
 end;
 begin
  perform public.audit_event('00000000-0000-4000-8000-000000000011','Forged','employee',employee_uuid);
  raise exception 'FAIL: audit helper exposed';
 exception when insufficient_privilege then null;
 end;
 begin
  delete from public.employees where id=employee_uuid;
  raise exception 'FAIL: direct employee deletion allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
do $$ begin
 if (select count(*) from public.audit_logs where company_id='00000000-0000-4000-8000-000000000011' and action='Employee Created')<>1 then raise exception 'FAIL: atomic audit insert'; end if;
end $$;
rollback;
