-- Restore application behavior from migrations 001-048 after running 049 and 050.
-- Run the ENTIRE file in Supabase SQL Editor as the project owner.
-- Retains employees, attendance, salaries, audit and financial history.
-- Extra master-history tables/columns remain for preservation, with app access disabled.
-- Existing designation presets are reactivated; earlier individual inactive states
-- were overwritten by 049 and cannot be reconstructed without a prior backup.
-- Does not recreate attendance that was actually deleted, or undo uploaded salaries.
begin;
select pg_advisory_xact_lock(210049050);
lock table public.companies in share row exclusive mode;

CREATE OR REPLACE FUNCTION public.apply_designation_salaries(c uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare e uuid;n integer:=0;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 for e in select id from public.employees where company_id=c and salary_mode='designation'loop
 if public.apply_designation_salary_internal(c,e)is not null then n:=n+1;end if;end loop;return n;
end $function$
;
revoke all on function public.apply_designation_salaries(uuid) from public,anon,authenticated,service_role;
grant execute on function public.apply_designation_salaries(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.assign_salary(c uuid, e uuid, s uuid, effective date, amounts jsonb, remarks_text text DEFAULT ''::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare aid uuid;begin
 aid:=public.assign_salary_before_designation(c,e,s,effective,amounts,remarks_text);
 update public.employees set salary_mode='custom'where company_id=c and id=e;return aid;
end $function$
;
revoke all on function public.assign_salary(uuid,uuid,uuid,date,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.assign_salary(uuid,uuid,uuid,date,jsonb,text) to authenticated;

revoke all on function public.attendance_month_delete_preview(uuid,date) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.bulk_update_employees(c uuid, employee_ids uuid[], field_name text, field_value jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare eid uuid; emp public.employees; dep uuid;
begin
 perform public.require_permission(c,'employees.write');perform 1 from public.companies where id=c for update;
 if cardinality(employee_ids) not between 1 and 1000 then raise exception 'Invalid employee count' using errcode='22023'; end if;
 if field_name not in ('department','workLocation','state','pfApplicable','esiApplicable') then raise exception 'Invalid bulk field' using errcode='22023'; end if;
 if field_name in ('pfApplicable','esiApplicable') then
  perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
  if jsonb_typeof(field_value)<>'boolean' then raise exception 'Boolean required' using errcode='22023'; end if;
 else
  if jsonb_typeof(field_value)<>'string' or length(field_value#>>'{}') not between 1 and 160 then raise exception 'Text required' using errcode='22023'; end if;
 end if;
 for eid in select distinct value from unnest(employee_ids) value order by value loop
  select * into emp from public.employees where company_id=c and id=eid for update;
  if not found then raise exception 'Employee not found in company' using errcode='P0002'; end if;
  if field_name='department' then
   insert into public.departments(company_id,name) values(c,field_value#>>'{}') on conflict(company_id,name) do update set name=excluded.name returning id into dep;
   update public.employees set department_id=dep,version=version+1,updated_at=now() where company_id=c and id=eid;
  elsif field_name='workLocation' then
   update public.employees set work_location=field_value#>>'{}',version=version+1,updated_at=now() where company_id=c and id=eid;
  elsif field_name='state' then
   update public.employees set state=field_value#>>'{}',version=version+1,updated_at=now() where company_id=c and id=eid;
  else
   insert into public.employee_statutory_details(company_id,employee_id) values(c,eid) on conflict do nothing;
   if field_name='pfApplicable' then update public.employee_statutory_details set pf_applicable=(field_value#>>'{}')::boolean where company_id=c and employee_id=eid;
   else update public.employee_statutory_details set esi_applicable=(field_value#>>'{}')::boolean where company_id=c and employee_id=eid; end if;
  end if;
  perform public.audit_event(c,'Employee Bulk Updated','employee',eid,jsonb_build_object('field',field_name));
 end loop;
end $function$
;
revoke all on function public.bulk_update_employees(uuid,uuid[],text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.bulk_update_employees(uuid,uuid[],text,jsonb) to authenticated;

revoke all on function public.bulk_update_employees_before_master(uuid,uuid[],text,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.calculate_payroll(c uuid, m date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare run public.payroll_runs;emp public.employees;validation jsonb;finish date:=(m+interval '1 month - 1 day')::date;calendar_days integer;proration_days integer;proration_mode text;item record;
 amounts jsonb;deductions jsonb;employers jsonb;rules jsonb;gross bigint;deduct bigint;cost bigint;wage bigint;employee_amount bigint;employer_amount bigint;r public.company_statutory_settings;stat public.employee_statutory_details;required boolean;kind text;paid_days numeric;baseline_gross bigint;salary_snapshot jsonb;attendance_snapshot jsonb;
begin
 perform public.require_permission(c,'payroll.run');perform 1 from public.companies where id=c for update;
 insert into public.payroll_runs(company_id,month)values(c,m)on conflict(company_id,month)do nothing;
 select * into run from public.payroll_runs where company_id=c and month=m for update;
 if run.status not in('Draft','Calculated')then raise exception 'Payroll is approved or locked'using errcode='23514';end if;
 validation:=public.validate_payroll(c,m);if(validation->>'blockingErrors')::integer>0 then raise exception 'Payroll validation failed'using errcode='23514';end if;
 calendar_days:=finish-m+1;select coalesce(settings#>>'{payroll,proration}','calendar')into proration_mode from public.company_settings where company_id=c;proration_mode:=coalesce(proration_mode,'calendar');
 delete from public.payroll_run_components where company_id=c and run_id=run.id;delete from public.payroll_run_employees where company_id=c and run_id=run.id;
 for emp in select * from public.employees where company_id=c and joining_date<=finish and(exit_date is null or exit_date>=m)and status not in('Inactive','Salary Hold')order by id for update loop
  proration_days:=case when proration_mode='working'then(select count(*)from generate_series(m,finish,interval '1 day')day where public.payroll_is_working_day(c,emp.id,day::date))else calendar_days end;amounts:='{}';deductions:='{}';employers:='{}';rules:='{}';gross:=0;deduct:=0;cost:=0;baseline_gross:=0;
  select coalesce(sum(public.payroll_paid_weight(c,emp.id,date,status,proration_mode)),0)into paid_days from public.attendance_records where company_id=c and employee_id=emp.id and date between greatest(m,emp.joining_date)and least(finish,coalesce(emp.exit_date,finish));
  -- Daily effective salary resolution segments mid-month revisions and join/exit dates.
  -- Numeric intermediates are exact; round only after summing each component.
  for item in

   select v.component_code,sc.kind,
    public.payroll_round(c,sum(case when sc.kind='earning'and v.component_code not in('bonus','variable')then v.amount_minor::numeric*public.payroll_paid_weight(c,emp.id,d::date,ar.status,proration_mode)
     else case when d::date=least(finish,coalesce(emp.exit_date,finish))then v.amount_minor::numeric*proration_days else 0 end end)/proration_days)::bigint amount,
    public.payroll_round(c,sum(case when sc.kind='earning'and v.component_code not in('bonus','variable')then v.amount_minor::numeric*case when proration_mode='working'then case when public.payroll_is_working_day(c,emp.id,d::date)then 1 else 0 end else 1 end
     else case when d::date=least(finish,coalesce(emp.exit_date,finish))then v.amount_minor::numeric*proration_days else 0 end end)/proration_days)::bigint full_amount
   from generate_series(greatest(m,emp.joining_date),least(finish,coalesce(emp.exit_date,finish)),interval '1 day')d
   join lateral(select public.salary_assignment_at(c,emp.id,d::date) id)a on true
   join public.employee_salary_component_values v on v.company_id=c and v.assignment_id=a.id join public.salary_components sc on sc.code=v.component_code
   join public.attendance_records ar on ar.company_id=c and ar.employee_id=emp.id and ar.date=d::date group by v.component_code,sc.kind
  loop
   if item.kind='earning'then amounts:=amounts||jsonb_build_object(item.component_code,item.amount);gross:=gross+item.amount;baseline_gross:=baseline_gross+item.full_amount;
   elsif item.kind='deduction'then deductions:=deductions||jsonb_build_object(item.component_code,item.amount);deduct:=deduct+item.amount;
   else employers:=employers||jsonb_build_object(item.component_code,item.amount);cost:=cost+item.amount;end if;
  end loop;

  for item in select adjustment.kind,sum(adjustment.amount_minor)::bigint amount from public.payroll_adjustments adjustment where adjustment.company_id=c and adjustment.employee_id=emp.id and adjustment.month=m and adjustment.status='Reviewed'group by adjustment.kind loop
   if item.kind in('otherDeduction','uniformAdvance','vehicleDamage','recovery')then deductions:=deductions||jsonb_build_object(item.kind,coalesce((deductions->>item.kind)::bigint,0)+item.amount);deduct:=deduct+item.amount;
   else amounts:=amounts||jsonb_build_object(item.kind,coalesce((amounts->>item.kind)::bigint,0)+item.amount);gross:=gross+item.amount;baseline_gross:=baseline_gross+item.amount;end if;
  end loop;
  select * into stat from public.employee_statutory_details where company_id=c and employee_id=emp.id;
  foreach kind in array array['pf','esi','pt','tds']loop
   required:=case kind when 'pf'then stat.pf_applicable when 'esi'then stat.esi_applicable when 'pt'then stat.pt_applicable else stat.tds_applicable end;
   if required then
    select * into r from public.company_statutory_settings where company_id=c and code=kind and(state=''or state=emp.state)and effective_from<=m and(effective_to is null or effective_to>=finish)and verified_by is not null order by(state=emp.state)desc,effective_from desc limit 1;
    if not found then raise exception 'A configured statutory deduction needs a reviewed rule covering the month' using errcode='23514';end if; select coalesce(sum(coalesce((amounts->>code)::bigint,0)),0)into wage from unnest(r.wage_components)code;
    if r.wage_cap_minor is not null then wage:=least(wage,r.wage_cap_minor);end if;
    employee_amount:=public.payroll_round(c,wage::numeric*r.employee_basis_points/10000)::bigint+r.fixed_minor;employer_amount:=public.payroll_round(c,wage::numeric*r.employer_basis_points/10000)::bigint;
    deductions:=deductions||jsonb_build_object(kind,employee_amount);employers:=employers||jsonb_build_object(kind,employer_amount);rules:=rules||jsonb_build_object(kind,r.id);deduct:=deduct+employee_amount;cost:=cost+employer_amount;
   end if;
  end loop;
  if deduct>gross then raise exception 'Negative net payable; correct deductions before payroll'using errcode='23514';end if;
  select jsonb_build_object('effectiveFrom',a.effective_from,'structure',s.name,'amounts',jsonb_object_agg(v.component_code,v.amount_minor))into salary_snapshot
  from public.employee_salary_assignments a join public.salary_structures s on s.company_id=c and s.id=a.structure_id join public.employee_salary_component_values v on v.company_id=c and v.assignment_id=a.id
  where a.company_id=c and a.employee_id=emp.id and a.id=(select public.salary_assignment_at(c,emp.id,least(finish,coalesce(emp.exit_date,finish))))group by a.effective_from,s.name;
  select jsonb_build_object('payrollDays',least(finish,coalesce(emp.exit_date,finish))-greatest(m,emp.joining_date)+1,'present',count(*)filter(where status in('Present','Work From Home')),'paidLeave',count(*)filter(where status='Paid Leave'),'unpaidLeave',count(*)filter(where status='Unpaid Leave'),'absent',count(*)filter(where status='Absent'),'halfDays',count(*)filter(where status='Half Day'),'weeklyOff',count(*)filter(where status='Weekly Off'),'holidays',count(*)filter(where status='Holiday'),'missing',count(*)filter(where status='Missing Punch'),'payableDays',paid_days,'proration',proration_mode,'prorationDays',proration_days,'lopDays',coalesce(sum(case when proration_mode='working'and public.payroll_is_working_day(c,emp.id,date)is not true then 0 when status in('Absent','Unpaid Leave')then 1 when status='Half Day'then 0.5 else 0 end),0))into attendance_snapshot
  from public.attendance_records where company_id=c and employee_id=emp.id and date between greatest(m,emp.joining_date)and least(finish,coalesce(emp.exit_date,finish));
  insert into public.payroll_run_employees(company_id,run_id,employee_id,gross_minor,deduction_minor,net_minor,employer_minor,snapshot)
  values(c,run.id,emp.id,gross,deduct,gross-deduct,cost,jsonb_build_object('setupWarnings',(select coalesce(jsonb_agg(issue),'[]'::jsonb) from jsonb_array_elements(validation->'issues')issue where issue->>'employeeId'=emp.id::text and issue->>'severity'='Warning'),'employeeCode',emp.employee_code,'employeeName',emp.first_name||' '||emp.last_name,'departmentId',emp.department_id,'month',m,'calendarDays',calendar_days,'proration',proration_mode,'prorationDays',proration_days,'calendarBasis',jsonb_build_object('schedules',(select coalesce(jsonb_agg(to_jsonb(s)order by s.id),'[]')from public.work_schedules s where s.company_id=c and s.active and(s.employee_id=emp.id or s.employee_id is null)and s.effective_from<=finish and(s.effective_to is null or s.effective_to>=m)),'holidays',(select coalesce(jsonb_agg(to_jsonb(h)order by h.date),'[]')from public.holidays h where h.company_id=c and h.active and h.review_reference is not null and h.date between m and finish)),'paidDays',paid_days,'earnings',amounts,'deductions',deductions,'employer',employers,'ruleVersions',rules,'baselineGrossMinor',baseline_gross,'adjustments',(select coalesce(jsonb_agg(to_jsonb(a)order by a.id),'[]'::jsonb)from public.payroll_adjustments a where a.company_id=c and a.employee_id=emp.id and a.month=m and a.status='Reviewed'),'salary',salary_snapshot,'attendance',attendance_snapshot));
  for item in select key,value from jsonb_each_text(amounts)loop insert into public.payroll_run_components(company_id,run_id,employee_id,code,kind,amount_minor)values(c,run.id,emp.id,item.key,'earning',item.value::bigint);end loop;
  for item in select key,value from jsonb_each_text(deductions)loop insert into public.payroll_run_components(company_id,run_id,employee_id,code,kind,amount_minor,rule_id)values(c,run.id,emp.id,item.key,'deduction',item.value::bigint,(rules->>item.key)::uuid);end loop;
  for item in select key,value from jsonb_each_text(employers)loop insert into public.payroll_run_components(company_id,run_id,employee_id,code,kind,amount_minor,rule_id)values(c,run.id,emp.id,item.key,'employer',item.value::bigint,(rules->>item.key)::uuid);end loop;
 end loop;
 update public.payroll_runs set status='Calculated',version=version+1,calculated_by=auth.uid(),calculated_at=now()where company_id=c and id=run.id;
 insert into public.payroll_calculation_methods(company_id,run_id,run_version,method)select c,run.id,version,'exact-proration-v3-salary-carry'from public.payroll_runs where company_id=c and id=run.id;perform public.audit_event(c,'Payroll Calculated','payroll_run',run.id,jsonb_build_object('month',m));return run.id;
end $function$
;
revoke all on function public.calculate_payroll(uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.calculate_payroll(uuid,date) to authenticated;

revoke all on function public.delete_month_attendance(uuid,date,text,integer,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.import_attendance(c uuid, rows_json jsonb, reason_text text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare n integer;bid uuid;begin
 n:=public.save_attendance(c,rows_json,reason_text,false);
 insert into public.attendance_import_batches(company_id,actor_id,row_count)values(c,auth.uid(),n)returning id into bid;
 perform public.audit_event(c,'Attendance Imported','attendance_import',bid,jsonb_build_object('rows',n));return bid;
end $function$
;
revoke all on function public.import_attendance(uuid,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.import_attendance(uuid,jsonb,text) to authenticated;

revoke all on function public.import_attendance_before_master(uuid,jsonb,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.import_attendance_with_employees(c uuid, rows_json jsonb, new_employees jsonb, reason_text text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p jsonb;row_data jsonb;eid uuid;employee_name text;first_name_text text;last_name_text text;
 mapping jsonb:='{}';resolved jsonb:='[]';bid uuid;
begin
 perform public.require_permission(c,'attendance.write');
 perform 1 from public.companies where id=c for update;
 perform public.require_permission(c,'attendance.write');perform public.require_permission(c,'employees.write');
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 1000
 or new_employees is null or jsonb_typeof(new_employees)<>'array'or jsonb_array_length(new_employees)not between 1 and 500
 or octet_length(rows_json::text)+octet_length(new_employees::text)>1000000 then
  raise exception 'Invalid attendance import size'using errcode='22023';
 end if;
 for p in select value from jsonb_array_elements(new_employees)loop
  if coalesce(p->>'employeeCode','')!~'^[A-Za-z0-9_-]{1,40}$'or mapping?(p->>'employeeCode')then
   raise exception 'Invalid or duplicate new employee code'using errcode='22023';end if;
  if not exists(select 1 from jsonb_array_elements(rows_json)entry where entry->>'employeeId'=p->>'employeeCode')then
   raise exception 'New employee must have attendance in this file'using errcode='22023';end if;
  if exists(select 1 from public.employees where company_id=c and employee_code=p->>'employeeCode')then
   raise exception 'Employee code now exists; refresh and validate the import again'using errcode='40001';end if;
  employee_name:=regexp_replace(trim(coalesce(p->>'employeeName','')),'[[:space:]]+',' ','g');
  first_name_text:=split_part(employee_name,' ',1);last_name_text:=case when strpos(employee_name,' ')>0 then substr(employee_name,strpos(employee_name,' ')+1)else ''end;
  if employee_name=''or length(first_name_text)>100 or length(last_name_text)>100
  or coalesce(p->>'joiningDate','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'then
   raise exception 'New employee name and actual joining date required'using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(rows_json)entry where entry->>'employeeId'=p->>'employeeCode'and(entry->>'date')::date<(p->>'joiningDate')::date)then
   raise exception 'Attendance precedes the new employee joining date'using errcode='22023';end if;
  eid:=public.save_employee(c,jsonb_build_object('employeeCode',p->>'employeeCode','firstName',first_name_text,'lastName',last_name_text,
   'joiningDate',p->>'joiningDate','email','','phone','','department',coalesce(p->>'department',''),'designation',coalesce(p->>'designation','Other'),
   'workLocation',coalesce(p->>'workLocation',''),'state',coalesce(p->>'state',''),'counterCode',coalesce(p->>'counterCode',''),'counterName',coalesce(p->>'counterName','')));
  mapping:=mapping||jsonb_build_object(p->>'employeeCode',eid);
  perform public.audit_event(c,'Employee Created From Attendance','employee',eid,jsonb_build_object('joiningDate',p->>'joiningDate'));
 end loop;
 for row_data in select value from jsonb_array_elements(rows_json)loop
  if mapping?(row_data->>'employeeId')then row_data:=jsonb_set(row_data,'{employeeId}',mapping->(row_data->>'employeeId'));end if;
  resolved:=resolved||jsonb_build_array(row_data);
 end loop;
 bid:=public.import_attendance(c,resolved,reason_text);
 perform public.audit_event(c,'Attendance New Employees Imported','attendance_import',bid,jsonb_build_object('newEmployees',jsonb_array_length(new_employees)));
 return bid;
end $function$
;
revoke all on function public.import_attendance_with_employees(uuid,jsonb,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.import_attendance_with_employees(uuid,jsonb,jsonb,text) to authenticated;

revoke all on function public.import_employee_master(uuid,jsonb,boolean,jsonb) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.initialize_designation_presets(c uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;perform public.seed_designation_presets_internal(c);
end $function$
;
revoke all on function public.initialize_designation_presets(uuid) from public,anon,authenticated,service_role;
grant execute on function public.initialize_designation_presets(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.list_department_designations(c uuid)
 RETURNS TABLE(name text, department text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 perform public.require_permission(c,'employees.read');
 return query select p.designation_name,p.department from public.designation_salary_presets p where p.company_id=c and p.active order by p.department,p.designation_name;
end $function$
;
revoke all on function public.list_department_designations(uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_department_designations(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.list_designation_salary_names(c uuid)
 RETURNS TABLE(name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 perform public.require_permission(c,'employees.read');return query select designation_name from public.designation_salary_presets where company_id=c and active order by designation_name;
end $function$
;
revoke all on function public.list_designation_salary_names(uuid) from public,anon,authenticated,service_role;
grant execute on function public.list_designation_salary_names(uuid) to authenticated;

revoke all on function public.master_payroll_snapshot(uuid,uuid,date) from public,anon,authenticated,service_role;

revoke all on function public.payroll_master_reconciliation(uuid,date) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.protect_payroll_calculation_method()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$begin
 if new.status='Approved'and old.status='Calculated'and not exists(select 1 from public.payroll_calculation_methods where company_id=old.company_id and run_id=old.id and run_version=old.version and method='exact-proration-v3-salary-carry')then raise exception 'Payroll calculation method changed; recalculate before approval'using errcode='40001';end if;return new;
end $function$
;
revoke all on function public.protect_payroll_calculation_method() from public,anon,authenticated,service_role;

revoke all on function public.reconcile_saved_master_attendance(uuid,date,text) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.salary_assignment_at(c uuid, e uuid, d date)
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select a.id from public.employee_salary_assignments a where a.company_id=c and a.employee_id=e
 order by (a.effective_from<=d)desc,
 case when a.effective_from<=d then a.effective_from end desc,a.effective_from,a.id limit 1
$function$
;
revoke all on function public.salary_assignment_at(uuid,uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.salary_assignment_at(uuid,uuid,date) to authenticated;

CREATE OR REPLACE FUNCTION public.save_attendance(c uuid, rows_json jsonb, reason_text text, allow_update boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare normalized jsonb;begin
 perform public.require_permission(c,'attendance.write');
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 1000 then raise exception 'Invalid attendance rows'using errcode='22023';end if;
 select jsonb_agg(item||jsonb_build_object('status',case upper(trim(item->>'status'))when 'P'then 'Present'when 'A'then 'Absent'when 'WFH'then 'Work From Home'when 'HD'then 'Half Day'when 'L'then 'Paid Leave'when 'H'then 'Holiday'else item->>'status'end)order by ordinal)
 into normalized from jsonb_array_elements(rows_json)with ordinality r(item,ordinal);
 return public.save_attendance_before_aliases(c,normalized,reason_text,allow_update);
end $function$
;
revoke all on function public.save_attendance(uuid,jsonb,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.save_attendance(uuid,jsonb,text,boolean) to authenticated;

revoke all on function public.save_attendance_before_master(uuid,jsonb,text,boolean) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.save_designation_salary_preset(c uuid, preset uuid, expected_version integer, title text, amounts_json jsonb, is_active boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare item record;gross numeric:=0;sid uuid;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;perform public.require_permission(c,'salary.write');
 if length(trim(coalesce(title,'')))not between 1 and 100 or lower(trim(title))in('other','custom')or amounts_json is null or jsonb_typeof(amounts_json)<>'object'or not(amounts_json?'basic')or is_active is null then raise exception 'Invalid designation preset'using errcode='22023';end if;
 for item in select key,value from jsonb_each_text(amounts_json)loop
 if item.key not in('basic','da','hra','other')or item.value is null or item.value!~'^[0-9]+$'or item.value::numeric>9000000000000 then raise exception 'Invalid preset amount'using errcode='22023';end if;
 gross:=gross+item.value::numeric;end loop;
 if gross<=0 or gross>9000000000000 then raise exception 'Preset gross must be positive'using errcode='22023';end if;
 update public.designation_salary_presets set designation_name=trim(title),amounts=amounts_json,active=is_active,version=version+1,updated_at=now()where company_id=c and id=preset and version=expected_version returning structure_id into sid;
 if not found then raise exception 'Preset changed; refresh'using errcode='40001';end if;
 update public.salary_structures set name='Designation - '||trim(title),version=version+1 where company_id=c and id=sid;
 perform public.audit_event(c,'Designation Salary Preset Updated','salary_structure',sid,jsonb_build_object('presetId',preset));
end $function$
;
revoke all on function public.save_designation_salary_preset(uuid,uuid,integer,text,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.save_designation_salary_preset(uuid,uuid,integer,text,jsonb,boolean) to authenticated;

CREATE OR REPLACE FUNCTION public.save_employee(c uuid, p jsonb, employee_uuid uuid DEFAULT NULL::uuid, expected_version integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare dept text;begin
 perform public.require_permission(c,'employees.write');
 perform 1 from public.companies where id=c for update;
 perform public.require_permission(c,'employees.write');
 perform public.seed_designation_presets_internal(c);
 select department into dept from public.designation_salary_presets where company_id=c and designation_key=lower(trim(p->>'designation'))and active;
 if dept is not null and dept<>'General'then
  if nullif(trim(p->>'department'),'')is null then p:=p||jsonb_build_object('department',dept);
  elsif lower(trim(p->>'department'))<>lower(dept)then raise exception 'Designation % belongs to department %. Select that department or choose Other / Custom.',p->>'designation',dept using errcode='P0048';end if;
 end if;
 return public.save_employee_before_departments(c,p,employee_uuid,expected_version);
end $function$
;
revoke all on function public.save_employee(uuid,jsonb,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.save_employee(uuid,jsonb,uuid,integer) to authenticated;

CREATE OR REPLACE FUNCTION public.save_salary_structure(c uuid, p jsonb, e uuid DEFAULT NULL::uuid, expected_version integer DEFAULT NULL::integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid uuid; row_component jsonb; component_code text; old public.salary_structures;
begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 if length(coalesce(p->>'name','')) not between 1 and 160 then raise exception 'Name required' using errcode='22023';end if;
 if e is null then
  insert into public.salary_structures(company_id,name,status)values(c,p->>'name',coalesce(p->>'status','Draft'))returning id into sid;
 else
  select * into old from public.salary_structures where company_id=c and id=e for update;
  if not found then raise exception 'Structure not found' using errcode='P0002';end if;
  if expected_version is null or old.version<>expected_version then raise exception 'Stale structure' using errcode='40001';end if;
  update public.salary_structures set name=p->>'name',status=p->>'status',version=version+1 where company_id=c and id=e;sid:=e;
 end if;
 if p ? 'components' then
  if jsonb_typeof(p->'components')<>'array' then raise exception 'Invalid components' using errcode='22023';end if;
  delete from public.salary_structure_components where company_id=c and structure_id=sid;
  for row_component in select value from jsonb_array_elements(p->'components')loop
   component_code:=row_component->>'code';
   insert into public.salary_structure_components(company_id,structure_id,component_code,calculation_type,value_minor)
   values(c,sid,component_code,coalesce(row_component->>'calculationType','As per record'),(row_component->>'valueMinor')::bigint);
  end loop;
 end if;
 perform public.audit_event(c,'Salary Structure Saved','salary_structure',sid);return sid;
end $function$
;
revoke all on function public.save_salary_structure(uuid,jsonb,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.save_salary_structure(uuid,jsonb,uuid,integer) to authenticated;

CREATE OR REPLACE FUNCTION public.seed_designation_presets_internal(c uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item record;sid uuid;gross bigint;begin
 perform 1 from public.companies where id=c for update;
 if exists(select 1 from public.companies where id=c and designation_catalog_version>=1)then return;end if;
 perform public.seed_legacy_designation_presets_internal(c);
 for item in select * from (values
 ('IT','Software Developer',70000),('IT','IT Support Engineer',40000),
 ('Finance','Accountant',50000),('Finance','Finance Manager',90000),
 ('Human Resources','HR Executive',40000),('Human Resources','HR Manager',75000),
 ('Sales','Sales Executive',35000),('Sales','Sales Manager',80000),
 ('Operations','Operations Executive',32000),('Operations','Operations Supervisor',55000),
 ('Administration','Admin Executive',30000),('Administration','Office Manager',60000)
 ) as defaults(department,title,rupees) loop
 if exists(select 1 from public.designation_salary_presets where company_id=c and designation_key=lower(item.title))then continue;end if;
 gross:=item.rupees::bigint*100;
 insert into public.salary_structures(company_id,name,status)values(c,'Designation - '||item.title,'Active')on conflict(company_id,name)do nothing;
 select id into sid from public.salary_structures where company_id=c and name='Designation - '||item.title;
 insert into public.salary_structure_components(company_id,structure_id,component_code,calculation_type)select c,sid,code,'As per record'from unnest(array['basic','da','hra','other'])code on conflict do nothing;
 insert into public.designation_salary_presets(company_id,designation_name,department,structure_id,amounts)values(c,item.title,item.department,sid,jsonb_build_object('basic',gross/2,'da',gross/10,'hra',gross/5,'other',gross/5));
 end loop;
 update public.companies set designation_catalog_version=1 where id=c;
end $function$
;
revoke all on function public.seed_designation_presets_internal(uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.seed_legacy_designation_presets_internal(c uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare title text;gross bigint;sid uuid;ordinal integer:=0;begin
 if exists(select 1 from public.designation_salary_presets where company_id=c)then return;end if;
 foreach title in array array['Associate','Executive','Senior Executive','Supervisor','Team Lead','Manager','Senior Manager']loop
 ordinal:=ordinal+1;gross:=(array[2800000,4200000,5600000,6500000,7800000,9500000,12000000]::bigint[])[ordinal];
 insert into public.salary_structures(company_id,name,status)values(c,'Designation - '||title,'Active')on conflict(company_id,name)do nothing;
 select id into sid from public.salary_structures where company_id=c and name='Designation - '||title;
 insert into public.salary_structure_components(company_id,structure_id,component_code,calculation_type)select c,sid,code,'As per record'from unnest(array['basic','da','hra','other'])code on conflict do nothing;
 insert into public.designation_salary_presets(company_id,designation_name,structure_id,amounts)values(c,title,sid,jsonb_build_object('basic',gross/2,'da',gross/10,'hra',gross/5,'other',gross/5));
 end loop;
end $function$
;
revoke all on function public.seed_legacy_designation_presets_internal(uuid) from public,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.use_employee_designation_salary(c uuid, e uuid, effective date, expected_version integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare v integer;aid uuid;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 select version into v from public.employees where company_id=c and id=e for update;
 if expected_version is null or v is null or v<>expected_version then raise exception 'Employee changed; refresh'using errcode='40001';end if;
 if effective is null then raise exception 'Review the salary revision date'using errcode='22023';end if;
 aid:=public.apply_designation_salary_internal(c,e,true,effective);
 if aid is null then raise exception 'No active preset matches this designation. Use Other / Custom salary.'using errcode='22023';end if;return aid;
end $function$
;
revoke all on function public.use_employee_designation_salary(uuid,uuid,date,integer) from public,anon,authenticated,service_role;
grant execute on function public.use_employee_designation_salary(uuid,uuid,date,integer) to authenticated;

CREATE OR REPLACE FUNCTION public.validate_payroll(c uuid, m date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare checks jsonb; issues jsonb; blockers integer; warnings integer;
begin
 checks:=public.validate_payroll_before_optional_setup(c,m);
 select coalesce(jsonb_agg(case
 when item->>'check'='Missing Bank Details' then item||jsonb_build_object('severity','Warning','message','Bank details are optional for calculation. Complete them before preparing bank payments.')
 when item->>'check'='Statutory Configuration' then item||jsonb_build_object('severity','Warning','message','Statutory setup is incomplete. Unconfigured deductions are excluded; calculated net pay is provisional until setup is reviewed.')
 else item end),'[]'::jsonb) into issues from jsonb_array_elements(checks->'issues') item;
 select count(*) filter(where item->>'severity'='Blocking Error'),count(*) filter(where item->>'severity'='Warning') into blockers,warnings from jsonb_array_elements(issues)item;
 return checks||jsonb_build_object('issues',issues,'blockingErrors',blockers,'warnings',warnings,'passed',case when blockers=0 then (checks->>'totalChecked')::integer else 0 end);
end $function$
;
revoke all on function public.validate_payroll(uuid,date) from public,anon,authenticated,service_role;
grant execute on function public.validate_payroll(uuid,date) to authenticated;

revoke all on function public.validate_payroll_before_master(uuid,date) from public,anon,authenticated,service_role;

-- Restore earlier preset visibility without replacing amounts or assignments.
grant select on public.designation_salary_presets to authenticated;
update public.salary_structures s set status='Active'
where s.status='Archived' and exists(select 1 from public.designation_salary_presets p where p.company_id=s.company_id and p.structure_id=s.id);
update public.designation_salary_presets set active=true where not active;
revoke all on public.employee_master_revisions,public.attendance_master_matches from public,anon,authenticated;
delete from public.role_permissions where permission='attendance.delete';
notify pgrst,'reload schema';
commit;
