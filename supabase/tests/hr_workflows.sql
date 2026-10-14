-- Disposable integration fixture only. All records are rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at)values('10000000-0000-4000-8000-000000000001','workflow@example.invalid',now());
insert into public.user_profiles(id)values('10000000-0000-4000-8000-000000000001');
insert into public.companies(id,name)values('10000000-0000-4000-8000-000000000011','Workflow fixture');
insert into public.user_company_roles(company_id,user_id,role)values('10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','Super Admin');
insert into public.employees(id,company_id,employee_code,first_name,last_name,email,joining_date)values('10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000011','BASE','Fixture','Employee','fixture@example.invalid','2026-01-01');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$declare c uuid:='10000000-0000-4000-8000-000000000011';e uuid:='10000000-0000-4000-8000-000000000021';s uuid;t uuid;r uuid;batch jsonb;batch_id uuid;v integer;effective date:=(now()at time zone 'Asia/Kolkata')::date;begin
 s:=public.save_salary_structure(c,'{"name":"Fixture structure","status":"Active","components":[{"code":"basic"},{"code":"hra"}]}');
 perform public.assign_salary(c,e,s,'2026-10-01','{"basic":100000,"hra":30000}');
 perform public.assign_salary(c,e,s,'2026-10-16','{"basic":200000,"hra":30000}');
 if(select count(*)from public.employee_salary_assignments where company_id=c and employee_id=e)<>2 then raise exception 'FAIL salary revision history';end if;
 begin
  perform public.assign_salary(c,e,s,'2026-10-16','{"basic":300000}');raise exception 'FAIL duplicate effective date';
 exception when unique_violation then null;end;
 begin
  perform public.assign_salary(c,e,s,'2026-11-01','{"basic":1.1}');raise exception 'FAIL fractional minor unit accepted';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.import_employees(c,'[{"employeeCode":"ROLLBACK","firstName":"Fixture","lastName":"Import","email":"import@example.invalid","joiningDate":"2026-01-01"},{"employeeCode":"BASE","firstName":"Duplicate","lastName":"Import","email":"duplicate@example.invalid","joiningDate":"2026-01-01"}]');raise exception 'FAIL duplicate import accepted';
 exception when unique_violation then null;end;
 if exists(select 1 from public.employees where company_id=c and employee_code='ROLLBACK')then raise exception 'FAIL partial import persisted';end if;
 perform public.save_attendance(c,jsonb_build_array(jsonb_build_object('employeeId',e,'date','2026-10-01','status','Present')),'Initial attendance entry',false);
 begin
  perform public.save_attendance(c,jsonb_build_array(jsonb_build_object('employeeId',e,'date','2026-10-01','status','Absent')),'Initial attendance entry',false);
  raise exception 'FAIL initial attendance silently overwrote existing record';
 exception when unique_violation then null;end;
 if(select status from public.attendance_records where company_id=c and employee_id=e and date='2026-10-01')<>'Present'then raise exception 'FAIL duplicate changed attendance';end if;
 begin
  perform public.save_attendance(c,jsonb_build_array(jsonb_build_object('employeeId',e,'date','2026-10-01','status','Absent')),'',true);
  raise exception 'FAIL correction without audit reason accepted';
 exception when invalid_parameter_value then null;end;
 begin perform public.finalize_attendance(c,'2026-10-01');raise exception 'FAIL incomplete attendance finalized';exception when check_violation then null;end;
 select jsonb_agg(jsonb_build_object('employeeId',e,'date',d::date,'status','Present'))into batch from generate_series('2026-10-02'::date,'2026-10-31'::date,interval '1 day')d;
 perform public.save_attendance(c,batch,'fixture');perform public.finalize_attendance(c,'2026-10-01');
 begin perform public.save_attendance(c,jsonb_build_array(jsonb_build_object('employeeId',e,'date','2026-10-01','status','Absent')),'fixture');raise exception 'FAIL finalized edit accepted';exception when check_violation then null;end;
 begin perform public.finalize_attendance(c,'2026-10-01',true,'');raise exception 'FAIL reopen without reason';exception when invalid_parameter_value then null;end;
 perform public.finalize_attendance(c,'2026-10-01',true,'Audited fixture correction');
 t:=public.save_leave_policy(c,'Casual Leave',true,array[1,2,3,4,5]::smallint[]);
 perform public.allocate_leave(c,e,t,'2026-01-01','2026-12-31',3);
 r:=public.request_leave(c,e,t,'2026-11-02','2026-11-03','Fixture request');perform public.decide_leave(c,r,'Approved');
 if(select used_days from public.employee_leave_balances where company_id=c and employee_id=e and type_id=t)<>2 then raise exception 'FAIL leave usage incorrect';end if;
 if(select count(*)from public.attendance_records where company_id=c and employee_id=e and date between '2026-11-02'and '2026-11-03'and status='Paid Leave')<>2 then raise exception 'FAIL approved leave missing attendance';end if;
 begin perform public.decide_leave(c,r,'Approved');raise exception 'FAIL double approval accepted';exception when check_violation then null;end;
 begin perform public.request_leave(c,e,t,'2026-11-03','2026-11-04','Overlap');raise exception 'FAIL overlap accepted';exception when check_violation then null;end;
 r:=public.request_leave(c,e,t,'2026-11-05','2026-11-06','Overdraw request');
 begin perform public.decide_leave(c,r,'Approved');raise exception 'FAIL overdraw accepted';exception when check_violation then null;end;
 if(select status from public.leave_requests where company_id=c and id=r)<>'Pending'then raise exception 'FAIL failed approval changed request';end if;
 batch_id:=public.import_salary(c,jsonb_build_array(jsonb_build_object('employeeId',e,'structureId',s,'effectiveFrom','2026-10-25','amounts',jsonb_build_object('basic',250000),'remarks','Fixture import')));
 if not exists(select 1 from public.salary_import_batches where company_id=c and id=batch_id and row_count=1)then raise exception 'FAIL salary import missing persistent batch';end if;
 begin
  perform public.import_salary(c,jsonb_build_array(jsonb_build_object('employeeId',e,'structureId',s,'effectiveFrom','2026-11-01','amounts',jsonb_build_object('basic',300000)),jsonb_build_object('employeeId',e,'structureId',s,'effectiveFrom','2026-10-16','amounts',jsonb_build_object('basic',300000))));raise exception 'FAIL duplicate salary import accepted';
 exception when unique_violation then null;end;
 if exists(select 1 from public.employee_salary_assignments where company_id=c and employee_id=e and effective_from='2026-11-01')then raise exception 'FAIL partial salary import persisted';end if;
 select version into v from public.employees where company_id=c and id=e;
 perform public.change_employment_status(c,e,'Exited',effective,'Fixture exit','Fixture notes',v,jsonb_build_object('lastWorkingDate',effective-1,'exitType','Resignation','settlementStatus','Not Started'));
 if(select exit_date from public.employees where company_id=c and id=e)<>effective-1 or not exists(select 1 from public.employee_exit_details where company_id=c and employee_id=e and exit_type='Resignation')then raise exception 'FAIL exit detail/cutoff persistence';end if;
 begin perform public.change_employment_status(c,e,'Active',effective,'Stale fixture','',v,null);raise exception 'FAIL stale lifecycle version';exception when serialization_failure then null;end;
end $$;
rollback;
