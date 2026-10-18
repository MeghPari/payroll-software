begin;
insert into auth.users(id,email,email_confirmed_at)values('44000000-0000-4000-8000-000000000001','attendance-new@example.invalid',now());
insert into public.user_profiles(id)values('44000000-0000-4000-8000-000000000001');
insert into public.companies(id,name)values('44000000-0000-4000-8000-000000000011','New attendance fixture');
insert into public.user_company_roles(company_id,user_id,role)values('44000000-0000-4000-8000-000000000011','44000000-0000-4000-8000-000000000001','Super Admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','44000000-0000-4000-8000-000000000001',true);
do $$declare c uuid:='44000000-0000-4000-8000-000000000011';p jsonb;rows_json jsonb;e uuid;bid uuid;begin
 p:='{"employeeCode":"OUTSIDE1","employeeName":"New Person","joiningDate":"2026-09-01","counterCode":"A01","counterName":"Client Counter","workLocation":"Delhi","state":"Delhi","department":"Operations"}';
 rows_json:='[{"employeeId":"OUTSIDE1","date":"2026-09-01","status":"Present","shift":"","checkIn":"","checkOut":"","workMinutes":0,"overtimeMinutes":0,"leaveType":"","remarks":"Fixture"}]';
 bid:=public.import_attendance_with_employees(c,rows_json,jsonb_build_array(p),'Reviewed fixture');
 select id into strict e from public.employees where company_id=c and employee_code='OUTSIDE1';
 if(select counter_code<>'A01'or joining_date<>'2026-09-01'from public.employees where id=e)then raise exception 'FAIL imported new employee details';end if;
 if not exists(select 1 from public.attendance_records where company_id=c and employee_id=e and date='2026-09-01'and status='Present')then raise exception 'FAIL new employee attendance missing';end if;
 if exists(select 1 from public.employee_salary_assignments where company_id=c and employee_id=e)or exists(select 1 from public.employee_bank_details where company_id=c and employee_id=e)then raise exception 'FAIL invented salary/bank';end if;
 if not exists(select 1 from public.attendance_import_batches where id=bid)then raise exception 'FAIL import history missing';end if;
 begin perform public.import_attendance_with_employees(c,rows_json,jsonb_build_array(p),'Retry fixture');raise exception 'FAIL duplicate creation accepted';exception when serialization_failure then null;end;
 -- A new employee and duplicate rows must roll back together.
 begin perform public.import_attendance_with_employees(c,replace((rows_json||rows_json)::text,'OUTSIDE1','ROLLBACK1')::jsonb,jsonb_build_array(p||'{"employeeCode":"ROLLBACK1"}'),'Atomic fixture');raise exception 'FAIL duplicate dates accepted';exception when unique_violation then null;end;
 if exists(select 1 from public.employees where company_id=c and employee_code='ROLLBACK1')then raise exception 'FAIL partial employee created';end if;
 begin perform public.import_attendance_with_employees(c,replace(rows_json::text,'OUTSIDE1','EARLY1')::jsonb,jsonb_build_array(p||'{"employeeCode":"EARLY1","joiningDate":"2026-09-02"}'),'Early fixture');raise exception 'FAIL pre-joining attendance accepted';exception when invalid_parameter_value then null;end;
 if exists(select 1 from public.employees where company_id=c and employee_code='EARLY1')then raise exception 'FAIL early date created employee';end if;
 -- HR users need no salary/private-bank write for this basic onboarding.
 reset role;
 update public.user_company_roles set role='HR Admin'where company_id=c;
 set local role authenticated;
 perform public.import_attendance_with_employees(c,replace(rows_json::text,'OUTSIDE1','HRNEW')::jsonb,jsonb_build_array(p||'{"employeeCode":"HRNEW"}'),'HR fixture');
 reset role;
 update public.user_company_roles set role='Employee'where company_id=c;
 set local role authenticated;
 begin perform public.import_attendance_with_employees(c,rows_json,jsonb_build_array(p),'Forbidden fixture');raise exception 'FAIL employee import access';exception when insufficient_privilege then null;end;
end $$;
rollback;
