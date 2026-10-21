begin;
insert into auth.users(id,email,email_confirmed_at)values('49000000-0000-4000-8000-000000000001','master@example.invalid',now());
insert into public.user_profiles(id)values('49000000-0000-4000-8000-000000000001');
insert into public.companies(id,name)values('49000000-0000-4000-8000-000000000011','Master fixture');
insert into public.user_company_roles(company_id,user_id,role)values('49000000-0000-4000-8000-000000000011','49000000-0000-4000-8000-000000000001','Super Admin');
set local role authenticated;
select set_config('request.jwt.claim.sub','49000000-0000-4000-8000-000000000001',true);
do $$declare c uuid:='49000000-0000-4000-8000-000000000011';p jsonb;p2 jsonb;p3 jsonb;p4 jsonb;e uuid;e2 uuid;batch jsonb;r uuid;v integer;n integer;saved jsonb;versions jsonb;checks jsonb;begin
 checks:=public.validate_payroll(c,'2026-05-01');if not exists(select 1 from jsonb_array_elements(checks->'issues')i where i->>'check'='Employee Database')then raise exception 'FAIL payroll before master';end if;
 if exists(select 1 from public.salary_structures where company_id=c and status='Active'and name like 'Designation - %')then raise exception 'FAIL presets seeded';end if;
 begin perform public.save_employee(c,'{"firstName":"No","lastName":"Defaults","email":"","joiningDate":"2026-05-01","designation":"Software Developer"}');raise exception 'FAIL manual creation';exception when sqlstate 'P0049'then null;end;
 p:='{"employeeCode":"M1","employeeName":"Same Name","gender":"","dateOfBirth":"","maritalStatus":"","phone":"","aadhaar":"","pan":"","uan":"","esicNumber":"","joiningDate":"2026-05-01","exitDate":"","clientStatus":"Active","counterCode":"C1","counterName":"Counter","reportingManager":"","workLocation":"Delhi","state":"Delhi","department":"Client Function","designation":"Client Role","accountNumber":"","ifscCode":"","amounts":{"basic":1000000,"da":300000,"hra":400000,"other":200000},"salaryEffectiveFrom":"2026-05-01","salaryReference":{"grossMinor":1900000,"pfMinor":100000,"esiMinor":10000,"ctcMinor":2200000}}';
 p2:=p||'{"employeeCode":"M2","amounts":{"basic":2000000,"da":100000,"hra":700000,"other":200000},"salaryReference":{"grossMinor":3000000,"pfMinor":0,"esiMinor":0,"ctcMinor":3000000}}';
 p3:=p||'{"employeeCode":"M3","joiningDate":"2026-05-16","salaryEffectiveFrom":"2026-05-16"}';
 p4:=p||'{"employeeCode":"M4","clientStatus":"Left","exitDate":"2026-05-15"}';
 begin perform public.import_employee_master(c,jsonb_build_array(p,p));raise exception 'FAIL duplicate codes';exception when sqlstate 'P0049'then null;end;
 begin perform public.import_employee_master(c,jsonb_build_array(p||'{"amounts":{"basic":1000000}}'));raise exception 'FAIL incomplete salary';exception when sqlstate 'P0049'then null;end;
 begin perform public.import_employee_master(c,jsonb_build_array(p||'{"salaryReference":{"grossMinor":999}}'));raise exception 'FAIL invalid salary';exception when sqlstate 'P0049'then null;end;
 perform public.import_employee_master(c,jsonb_build_array(p,p2,p3,p4));
 select id,version into e,v from public.employees where company_id=c and employee_code='M1';select id into e2 from public.employees where company_id=c and employee_code='M2';
 if(select count(*)from public.employees where company_id=c)<>4 then raise exception 'FAIL master count';end if;
 if(select pf_applicable from public.employee_statutory_details where company_id=c and employee_id=e)is not null then raise exception 'FAIL PF reference inferred deduction';end if;
 select jsonb_object_agg(employee_code,version)into versions from public.employees where company_id=c;
 perform public.import_employee_master(c,jsonb_build_array(p,p2,p3,p4),true,versions);
 if(select count(*)from public.employee_salary_assignments where company_id=c)<>4 then raise exception 'FAIL unchanged reupload created salary revisions';end if;
 -- Attendance cannot create employees or be supplied before a master exists.
 begin perform public.import_attendance_with_employees(c,'[]','[]','Unknown');raise exception 'FAIL attendance onboarding';exception when sqlstate 'P0049'then null;end;
 batch:=jsonb_build_array(jsonb_build_object('employeeId',e,'date','2026-05-01','status','A','checkIn',null,'checkOut',null,'workHours',0,'overtime',0));
 perform public.import_attendance(c,batch,'Reviewed attendance');
 begin perform public.import_attendance(c,batch,'Duplicate');raise exception 'FAIL duplicate attendance';exception when unique_violation then null;end;
 if not exists(select 1 from jsonb_array_elements(public.payroll_master_reconciliation(c,'2026-05-01')->'rows')matched_entry where matched_entry->>'employeeCode'='M2'and(matched_entry->>'recordedDays')::integer=0 and not(matched_entry->>'matchedUpload')::boolean)then raise exception 'FAIL missing attendance employee not reconciled';end if;
 checks:=public.validate_payroll(c,'2026-05-01');if(checks->>'blockingErrors')::integer=0 then raise exception 'FAIL incomplete attendance passed';end if;
 -- Full employed coverage, with one day absent for M1. No name-based matching.
 select jsonb_agg(jsonb_build_object('employeeId',emp.id,'date',d::date,'status','P','checkIn',null,'checkOut',null,'workHours',0,'overtime',0))into batch from public.employees emp cross join lateral generate_series(greatest('2026-05-01'::date,emp.joining_date),least('2026-05-31'::date,coalesce(emp.exit_date,'2026-05-31'::date)),'1 day')d where emp.company_id=c and not(emp.id=e and d::date='2026-05-01');
 perform public.import_attendance(c,batch,'Reviewed rest of attendance');perform public.finalize_attendance(c,'2026-05-01');
 r:=public.calculate_payroll(c,'2026-05-01');
 if(select gross_minor from public.payroll_run_employees where company_id=c and run_id=r and employee_id=e)<>1838710 then raise exception 'FAIL partial attendance exact pay';end if;
 if(select gross_minor from public.payroll_run_employees where company_id=c and run_id=r and employee_id=e2)<>3000000 then raise exception 'FAIL different salary full attendance';end if;
 if not exists(select 1 from public.payroll_run_employees p join public.employees e on e.id=p.employee_id where p.run_id=r and e.employee_code='M3'and p.gross_minor=980646)then raise exception 'FAIL mid-month joining proration';end if;
 if not exists(select 1 from public.payroll_run_employees p join public.employees e on e.id=p.employee_id where p.run_id=r and e.employee_code='M4'and p.gross_minor=919354)then raise exception 'FAIL mid-month leaving proration';end if;
 if(select deduction_minor from public.payroll_run_employees where company_id=c and run_id=r and employee_id=e)<>0 then raise exception 'FAIL S.PF/ESI treated as deductions';end if;
 if not exists(select 1 from public.payroll_run_employees where run_id=r and snapshot->'employeeMaster'->'contractual'->>'basic'='1000000')then raise exception 'FAIL uploaded salary snapshot';end if;
 select jsonb_agg(to_jsonb(t)order by employee_id)into saved from public.payroll_run_employees t where run_id=r;
 perform public.calculate_payroll(c,'2026-05-01');
 if saved<>(select jsonb_agg(to_jsonb(t)order by employee_id)from public.payroll_run_employees t where run_id=r)then
 -- IDs can differ on recalculation; amounts and snapshot content must not.
 if saved->0->'snapshot'<>(select jsonb_agg(to_jsonb(t)order by employee_id)from public.payroll_run_employees t where run_id=r)->0->'snapshot'then raise exception 'FAIL inconsistent recalculation';end if;end if;
 select version into v from public.payroll_runs where id=r;perform public.transition_payroll(c,'2026-05-01','approve',v);select version into v from public.payroll_runs where id=r;perform public.transition_payroll(c,'2026-05-01','lock',v);
 select jsonb_agg(to_jsonb(t)order by employee_id)into saved from public.payroll_run_employees t where run_id=r;
 select jsonb_object_agg(employee_code,version)into versions from public.employees where company_id=c;
 perform public.import_employee_master(c,jsonb_build_array(p||'{"salaryEffectiveFrom":"2026-06-01","amounts":{"basic":1100000,"da":300000,"hra":400000,"other":200000},"salaryReference":{"grossMinor":2000000,"pfMinor":100000,"esiMinor":10000,"ctcMinor":2300000}}'),true,versions);
 if saved<>(select jsonb_agg(to_jsonb(t)order by employee_id)from public.payroll_run_employees t where run_id=r)then raise exception 'FAIL historical payroll changed';end if;
 if public.salary_assignment_at(c,e,'2026-05-01')=public.salary_assignment_at(c,e,'2026-06-01')then raise exception 'FAIL salary revision dates';end if;
end $$;
rollback;
