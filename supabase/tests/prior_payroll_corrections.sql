begin;
insert into auth.users(id,email,email_confirmed_at)values('e1000000-0000-4000-8000-000000000001','corrections@example.invalid',now());insert into public.user_profiles(id)values('e1000000-0000-4000-8000-000000000001');
insert into public.companies(id,name)values('e2000000-0000-4000-8000-000000000001','Prior correction fixture');insert into public.user_company_roles(company_id,user_id,role)values('e2000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Super Admin');
insert into public.employees(id,company_id,employee_code,first_name,last_name,email,joining_date)values('e3000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','COR01','Correction','Employee','employee@example.invalid','2026-09-01');
insert into public.employee_bank_details(company_id,employee_id,account_number,ifsc_code)values('e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','1234567890','TEST0001234');
insert into public.employee_statutory_details(company_id,employee_id,pf_applicable,esi_applicable,pt_applicable,tds_applicable)values('e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',false,false,false,false);
select set_config('request.jwt.claim.sub','e1000000-0000-4000-8000-000000000001',true);set local role authenticated;
do $$declare c uuid:='e2000000-0000-4000-8000-000000000001';e uuid:='e3000000-0000-4000-8000-000000000001';s uuid;r uuid;a uuid;target uuid;v integer;rows jsonb;original jsonb;payslip jsonb;payload jsonb;begin
 s:=public.save_salary_structure(c,'{"name":"Correction fixture salary","status":"Active","components":[{"code":"basic"}]}');perform public.assign_salary(c,e,s,'2026-09-01','{"basic":10000}');
 select jsonb_agg(jsonb_build_object('employeeId',e,'date',d::date,'status','Present'))into rows from generate_series('2026-09-01'::date,'2026-09-30'::date,interval '1 day')d;perform public.save_attendance(c,rows,'Fixture actual register');perform public.finalize_attendance(c,'2026-09-01');r:=public.calculate_payroll(c,'2026-09-01');select version into v from public.payroll_runs where id=r;
 payload:=jsonb_build_object('employeeId',e,'sourceMonth','2026-09-01','sourceVersion',v,'month','2026-10-01','kind','arrears','amountMinor',1000,'reference','CORRECTION-1','reviewNote','Reviewed omitted amount');
 begin perform public.review_prior_payroll_correction(c,payload);raise exception 'FAIL unprotected source correction';exception when check_violation then null;end;
 perform public.transition_payroll(c,'2026-09-01','approve',v);select version into v from public.payroll_runs where id=r;perform public.transition_payroll(c,'2026-09-01','lock',v);perform public.generate_payslips(c,'2026-09-01');perform public.publish_payslips(c,'2026-09-01');select version into v from public.payroll_runs where id=r;
 select snapshot into original from public.payroll_run_employees where run_id=r;select content into payslip from public.payslips where run_id=r;
 payload:=payload||jsonb_build_object('sourceVersion',v);a:=public.review_prior_payroll_correction(c,payload);
 if(select source_run_id from public.payroll_adjustments where id=a)<>r or(select(source_snapshot->>'netMinor')::bigint from public.payroll_adjustments where id=a)<>10000 then raise exception 'FAIL captured correction source';end if;
 begin perform public.review_prior_payroll_correction(c,payload);raise exception 'FAIL duplicate correction';exception when unique_violation then null;end;
 begin perform public.review_prior_payroll_correction(c,payload||jsonb_build_object('sourceVersion',v-1));raise exception 'FAIL stale correction source';exception when serialization_failure then null;end;
 begin perform public.review_prior_payroll_correction(c,payload||'{"month":"2026-09-01"}');raise exception 'FAIL historical month correction';exception when invalid_parameter_value then null;end;
 begin perform public.review_prior_payroll_correction('e2000000-0000-4000-8000-000000000099',payload);raise exception 'FAIL cross-tenant correction';exception when insufficient_privilege then null;end;
 perform public.review_prior_payroll_correction(c,payload||'{"kind":"otherDeduction","amountMinor":500,"reference":"RECOVERY-1","reviewNote":"Reviewed prior overpayment recovery"}');
 select jsonb_agg(jsonb_build_object('employeeId',e,'date',d::date,'status','Present'))into rows from generate_series('2026-10-01'::date,'2026-10-31'::date,interval '1 day')d;perform public.save_attendance(c,rows,'Fixture later month register');perform public.finalize_attendance(c,'2026-10-01');target:=public.calculate_payroll(c,'2026-10-01');
 if(select net_minor from public.payroll_run_employees where run_id=target)<>10500 or(select jsonb_array_length(snapshot->'adjustments')from public.payroll_run_employees where run_id=target)<>2 then raise exception 'FAIL correction applied to later payroll';end if;
 if(select snapshot from public.payroll_run_employees where run_id=r)is distinct from original or(select content from public.payslips where run_id=r)is distinct from payslip then raise exception 'FAIL original published payroll changed';end if;
end $$;
reset role;
-- Only the test database administrator removes provenance to represent a pre-upgrade calculation.
delete from public.payroll_calculation_methods where company_id='e2000000-0000-4000-8000-000000000001'and run_id=(select id from public.payroll_runs where company_id='e2000000-0000-4000-8000-000000000001'and month='2026-10-01');
set local role authenticated;
do $$declare c uuid:='e2000000-0000-4000-8000-000000000001';r uuid;v integer;begin
 select id,version into r,v from public.payroll_runs where company_id=c and month='2026-10-01';
 begin perform public.transition_payroll(c,'2026-10-01','approve',v);raise exception 'FAIL legacy calculation approved';exception when serialization_failure then if SQLERRM<>'Payroll calculation method changed; recalculate before approval'then raise;end if;end;
 perform public.calculate_payroll(c,'2026-10-01');select version into v from public.payroll_runs where id=r;
 if not exists(select 1 from public.payroll_calculation_methods where company_id=c and run_id=r and run_version=v and method='exact-proration-v3-salary-carry')then raise exception 'FAIL calculation method provenance';end if;
 perform public.transition_payroll(c,'2026-10-01','approve',v);
 begin delete from public.payroll_calculation_methods;raise exception 'FAIL method history forging';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
