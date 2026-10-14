begin;
create table public.company_statutory_settings (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),code text not null check(code in('pf','esi','pt','tds')),
 state text not null default '',effective_from date not null,effective_to date check(effective_to>=effective_from),
 wage_components text[]not null check(cardinality(wage_components)>0),employee_basis_points integer not null check(employee_basis_points between 0 and 10000),
 employer_basis_points integer not null default 0 check(employer_basis_points between 0 and 10000),wage_cap_minor bigint check(wage_cap_minor>=0),
 fixed_minor bigint not null default 0 check(fixed_minor>=0),verified_by uuid references public.user_profiles(id),verification_reference text,
 created_at timestamptz not null default now(),unique(company_id,code,state,effective_from)
);
create table public.payroll_runs (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),month date not null check(extract(day from month)=1),
 status text not null default 'Draft'check(status in('Draft','Calculated','Approved','Locked')),version integer not null default 1,
 calculated_by uuid references public.user_profiles(id),calculated_at timestamptz,approved_by uuid references public.user_profiles(id),approved_at timestamptz,
 locked_by uuid references public.user_profiles(id),locked_at timestamptz,unique(company_id,id),unique(company_id,month)
);
create table public.payroll_run_employees (
 company_id uuid not null,run_id uuid not null,employee_id uuid not null,gross_minor bigint not null check(gross_minor>=0),deduction_minor bigint not null check(deduction_minor>=0),
 net_minor bigint not null check(net_minor>=0),employer_minor bigint not null check(employer_minor>=0),snapshot jsonb not null,
 primary key(company_id,run_id,employee_id),check(net_minor=gross_minor-deduction_minor),foreign key(company_id,run_id)references public.payroll_runs(company_id,id),foreign key(company_id,employee_id)references public.employees(company_id,id)
);
create table public.payroll_run_components (
 company_id uuid not null,run_id uuid not null,employee_id uuid not null,code text not null,kind text not null check(kind in('earning','deduction','employer')),
 amount_minor bigint not null check(amount_minor>=0),rule_id uuid references public.company_statutory_settings(id),
 primary key(company_id,run_id,employee_id,code,kind),foreign key(company_id,run_id,employee_id)references public.payroll_run_employees(company_id,run_id,employee_id)
);
create table public.payroll_approvals (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,run_id uuid not null,actor_id uuid not null references public.user_profiles(id),
 version integer not null,created_at timestamptz not null default now(),foreign key(company_id,run_id)references public.payroll_runs(company_id,id)
);
create table public.payroll_lock_history (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,run_id uuid not null,actor_id uuid not null references public.user_profiles(id),
 action text not null,reason text not null default '',created_at timestamptz not null default now(),foreign key(company_id,run_id)references public.payroll_runs(company_id,id)
);
create function public.validate_payroll(c uuid,m date)returns jsonb
language plpgsql security definer set search_path=''as $$declare emp public.employees;stat public.employee_statutory_details;issues jsonb:='[]';kind text;required boolean;finish date:=(m+interval '1 month - 1 day')::date;n integer:=0;begin
 perform public.require_permission(c,'payroll.run');
 if extract(day from m)<>1 then raise exception 'First day required'using errcode='22023';end if;
 if not exists(select 1 from public.attendance_periods where company_id=c and month=m and finalized_at is not null)then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId','','check','Attendance Finalization','severity','Blocking Error','message','Finalize attendance before calculating payroll.'));end if;
 for emp in select * from public.employees where company_id=c and joining_date<=finish and(exit_date is null or exit_date>=m)and status not in('Inactive','Salary Hold')loop
  n:=n+1;
  if exists(select 1 from public.salary_holds where company_id=c and employee_id=emp.id and month=m and released_at is null)then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Salary Hold','severity','Blocking Error','message','Release the salary hold or process an explicitly scoped correction.'));end if;
  if exists(select 1 from generate_series(greatest(m,emp.joining_date),least(finish,coalesce(emp.exit_date,finish)),interval '1 day')d where not exists(select 1 from public.employee_salary_assignments a where a.company_id=c and a.employee_id=emp.id and a.effective_from<=d::date))then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','No Salary Assigned','severity','Blocking Error','message','Salary must cover every employment day.'));end if;
  if not exists(select 1 from public.employee_bank_details where company_id=c and employee_id=emp.id and account_number<>''and ifsc_code<>'')then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Missing Bank Details','severity','Blocking Error','message','Complete bank details before payroll.'));end if;
  select * into stat from public.employee_statutory_details where company_id=c and employee_id=emp.id;
  if not found or stat.pf_applicable is null or stat.esi_applicable is null or stat.pt_applicable is null or stat.tds_applicable is null then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Statutory Configuration','severity','Blocking Error','message','Explicitly configure all statutory applicability flags.'));
  else
   if stat.pf_applicable and stat.uan is null then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Missing UAN','severity','Blocking Error','message','UAN required for PF.'));end if;
   if stat.esi_applicable and nullif(stat.esic_number,'')is null then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Missing ESIC','severity','Blocking Error','message','ESIC number required for ESI.'));end if;
   if stat.tds_applicable and stat.pan is null then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Missing PAN','severity','Blocking Error','message','PAN required for configured TDS.'));end if;
   foreach kind in array array['pf','esi','pt','tds']loop
    required:=case kind when 'pf'then stat.pf_applicable when 'esi'then stat.esi_applicable when 'pt'then stat.pt_applicable else stat.tds_applicable end;
    if required and not exists(select 1 from public.company_statutory_settings r where r.company_id=c and r.code=kind and(r.state=''or r.state=emp.state)and r.effective_from<=m and(r.effective_to is null or r.effective_to>=finish)and r.verified_by is not null)then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Reviewed Rule Required','severity','Blocking Error','message','Configure a reviewed '||upper(kind)||' rule covering the entire month. Mid-month statutory rule changes require a reviewed segmented calculation.'));end if;
   end loop;
  end if;
 end loop;
 if n=0 then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId','','check','Employees','severity','Blocking Error','message','No employees are in scope for this payroll period.'));end if;
 return jsonb_build_object('issues',issues,'totalChecked',n,'passed',case when jsonb_array_length(issues)=0 then n else 0 end,'warnings',0,'blockingErrors',jsonb_array_length(issues));
end $$;

create function public.calculate_payroll(c uuid,m date)returns uuid
language plpgsql security definer set search_path=''as $$
declare run public.payroll_runs;emp public.employees;validation jsonb;finish date:=(m+interval '1 month - 1 day')::date;calendar_days integer;item record;
 amounts jsonb;deductions jsonb;employers jsonb;rules jsonb;gross bigint;deduct bigint;cost bigint;wage bigint;employee_amount bigint;employer_amount bigint;r public.company_statutory_settings;stat public.employee_statutory_details;required boolean;kind text;paid_days numeric;baseline_gross bigint;salary_snapshot jsonb;attendance_snapshot jsonb;
begin
 perform public.require_permission(c,'payroll.run');perform 1 from public.companies where id=c for update;
 insert into public.payroll_runs(company_id,month)values(c,m)on conflict(company_id,month)do nothing;
 select * into run from public.payroll_runs where company_id=c and month=m for update;
 if run.status not in('Draft','Calculated')then raise exception 'Payroll is approved or locked'using errcode='23514';end if;
 validation:=public.validate_payroll(c,m);if(validation->>'blockingErrors')::integer>0 then raise exception 'Payroll validation failed'using errcode='23514';end if;
 calendar_days:=finish-m+1;
 delete from public.payroll_run_components where company_id=c and run_id=run.id;delete from public.payroll_run_employees where company_id=c and run_id=run.id;
 for emp in select * from public.employees where company_id=c and joining_date<=finish and(exit_date is null or exit_date>=m)and status not in('Inactive','Salary Hold')order by id for update loop
  amounts:='{}';deductions:='{}';employers:='{}';rules:='{}';gross:=0;deduct:=0;cost:=0;baseline_gross:=0;
  select coalesce(sum(case when status in('Present','Paid Leave','Weekly Off','Holiday','Work From Home')then 1 when status='Half Day'then 0.5 else 0 end),0)into paid_days from public.attendance_records where company_id=c and employee_id=emp.id and date between greatest(m,emp.joining_date)and least(finish,coalesce(emp.exit_date,finish));
  -- Daily effective salary resolution segments mid-month revisions and join/exit dates.
  -- Numeric intermediates are exact; round only after summing each component.
  for item in
   select v.component_code,sc.kind,round(sum(case when sc.kind='earning'and v.component_code not in('bonus','variable')then v.amount_minor::numeric/calendar_days*case when ar.status in('Present','Paid Leave','Weekly Off','Holiday','Work From Home')then 1 when ar.status='Half Day'then 0.5 else 0 end
    else case when d::date=least(finish,coalesce(emp.exit_date,finish))then v.amount_minor else 0 end end))::bigint amount,round(sum(case when sc.kind='earning'and v.component_code not in('bonus','variable')then v.amount_minor::numeric/calendar_days else case when d::date=least(finish,coalesce(emp.exit_date,finish))then v.amount_minor else 0 end end))::bigint full_amount
   from generate_series(greatest(m,emp.joining_date),least(finish,coalesce(emp.exit_date,finish)),interval '1 day')d
   join lateral(select a.id from public.employee_salary_assignments a where a.company_id=c and a.employee_id=emp.id and a.effective_from<=d::date order by a.effective_from desc limit 1)a on true
   join public.employee_salary_component_values v on v.company_id=c and v.assignment_id=a.id join public.salary_components sc on sc.code=v.component_code
   join public.attendance_records ar on ar.company_id=c and ar.employee_id=emp.id and ar.date=d::date group by v.component_code,sc.kind
  loop
   if item.kind='earning'then amounts:=amounts||jsonb_build_object(item.component_code,item.amount);gross:=gross+item.amount;baseline_gross:=baseline_gross+item.full_amount;
   elsif item.kind='deduction'then deductions:=deductions||jsonb_build_object(item.component_code,item.amount);deduct:=deduct+item.amount;
   else employers:=employers||jsonb_build_object(item.component_code,item.amount);cost:=cost+item.amount;end if;
  end loop;
  select * into stat from public.employee_statutory_details where company_id=c and employee_id=emp.id;
  foreach kind in array array['pf','esi','pt','tds']loop
   required:=case kind when 'pf'then stat.pf_applicable when 'esi'then stat.esi_applicable when 'pt'then stat.pt_applicable else stat.tds_applicable end;
   if required then
    select * into r from public.company_statutory_settings where company_id=c and code=kind and(state=''or state=emp.state)and effective_from<=m and(effective_to is null or effective_to>=finish)and verified_by is not null order by(state=emp.state)desc,effective_from desc limit 1;
    select coalesce(sum(coalesce((amounts->>code)::bigint,0)),0)into wage from unnest(r.wage_components)code;
    if r.wage_cap_minor is not null then wage:=least(wage,r.wage_cap_minor);end if;
    employee_amount:=round(wage::numeric*r.employee_basis_points/10000)::bigint+r.fixed_minor;employer_amount:=round(wage::numeric*r.employer_basis_points/10000)::bigint;
    deductions:=deductions||jsonb_build_object(kind,employee_amount);employers:=employers||jsonb_build_object(kind,employer_amount);rules:=rules||jsonb_build_object(kind,r.id);deduct:=deduct+employee_amount;cost:=cost+employer_amount;
   end if;
  end loop;
  if deduct>gross then raise exception 'Negative net payable; correct deductions before payroll'using errcode='23514';end if;
  select jsonb_build_object('effectiveFrom',a.effective_from,'structure',s.name,'amounts',jsonb_object_agg(v.component_code,v.amount_minor))into salary_snapshot
  from public.employee_salary_assignments a join public.salary_structures s on s.company_id=c and s.id=a.structure_id join public.employee_salary_component_values v on v.company_id=c and v.assignment_id=a.id
  where a.company_id=c and a.employee_id=emp.id and a.id=(select id from public.employee_salary_assignments where company_id=c and employee_id=emp.id and effective_from<=least(finish,coalesce(emp.exit_date,finish))order by effective_from desc limit 1)group by a.effective_from,s.name;
  select jsonb_build_object('payrollDays',least(finish,coalesce(emp.exit_date,finish))-greatest(m,emp.joining_date)+1,'present',count(*)filter(where status in('Present','Work From Home')),'paidLeave',count(*)filter(where status='Paid Leave'),'unpaidLeave',count(*)filter(where status='Unpaid Leave'),'absent',count(*)filter(where status='Absent'),'halfDays',count(*)filter(where status='Half Day'),'weeklyOff',count(*)filter(where status='Weekly Off'),'holidays',count(*)filter(where status='Holiday'),'missing',count(*)filter(where status='Missing Punch'),'payableDays',paid_days,'lopDays',count(*)filter(where status in('Absent','Unpaid Leave'))+count(*)filter(where status='Half Day')::numeric/2)into attendance_snapshot
  from public.attendance_records where company_id=c and employee_id=emp.id and date between greatest(m,emp.joining_date)and least(finish,coalesce(emp.exit_date,finish));
  insert into public.payroll_run_employees(company_id,run_id,employee_id,gross_minor,deduction_minor,net_minor,employer_minor,snapshot)
  values(c,run.id,emp.id,gross,deduct,gross-deduct,cost,jsonb_build_object('employeeCode',emp.employee_code,'employeeName',emp.first_name||' '||emp.last_name,'departmentId',emp.department_id,'month',m,'calendarDays',calendar_days,'paidDays',paid_days,'earnings',amounts,'deductions',deductions,'employer',employers,'ruleVersions',rules,'baselineGrossMinor',baseline_gross,'salary',salary_snapshot,'attendance',attendance_snapshot));
  for item in select key,value from jsonb_each_text(amounts)loop insert into public.payroll_run_components(company_id,run_id,employee_id,code,kind,amount_minor)values(c,run.id,emp.id,item.key,'earning',item.value::bigint);end loop;
  for item in select key,value from jsonb_each_text(deductions)loop insert into public.payroll_run_components(company_id,run_id,employee_id,code,kind,amount_minor,rule_id)values(c,run.id,emp.id,item.key,'deduction',item.value::bigint,(rules->>item.key)::uuid);end loop;
  for item in select key,value from jsonb_each_text(employers)loop insert into public.payroll_run_components(company_id,run_id,employee_id,code,kind,amount_minor,rule_id)values(c,run.id,emp.id,item.key,'employer',item.value::bigint,(rules->>item.key)::uuid);end loop;
 end loop;
 update public.payroll_runs set status='Calculated',version=version+1,calculated_by=auth.uid(),calculated_at=now()where company_id=c and id=run.id;
 perform public.audit_event(c,'Payroll Calculated','payroll_run',run.id,jsonb_build_object('month',m));return run.id;
end $$;
create function public.transition_payroll(c uuid,m date,action_text text,expected_version integer,reason_text text default '')returns void
language plpgsql security definer set search_path=''as $$declare run public.payroll_runs;begin
 perform public.require_permission(c,case action_text when 'approve'then 'payroll.approve'when 'lock'then 'payroll.lock'when 'unlock'then 'payroll.unlock'else 'payroll.run'end);
 perform 1 from public.companies where id=c for update;select * into run from public.payroll_runs where company_id=c and month=m for update;
 if not found then raise exception 'Calculate payroll first'using errcode='P0002';end if;
 if run.version<>expected_version then raise exception 'Payroll changed; refresh'using errcode='40001';end if;
 if action_text='approve'and run.status='Calculated'then
  if(public.validate_payroll(c,m)->>'blockingErrors')::integer>0 then raise exception 'Validation failed'using errcode='23514';end if;
  update public.payroll_runs set status='Approved',approved_by=auth.uid(),approved_at=now(),version=version+1 where company_id=c and id=run.id;
  insert into public.payroll_approvals(company_id,run_id,actor_id,version)values(c,run.id,auth.uid(),run.version);
 elsif action_text='lock'and run.status='Approved'then update public.payroll_runs set status='Locked',locked_by=auth.uid(),locked_at=now(),version=version+1 where company_id=c and id=run.id;
 elsif action_text='unlock'and run.status in('Approved','Locked')and length(trim(reason_text))>0 then update public.payroll_runs set status='Calculated',approved_by=null,approved_at=null,locked_by=null,locked_at=null,version=version+1 where company_id=c and id=run.id;
 else raise exception 'Invalid payroll transition or missing correction reason'using errcode='23514';end if;
 insert into public.payroll_lock_history(company_id,run_id,actor_id,action,reason)values(c,run.id,auth.uid(),action_text,reason_text);
 perform public.audit_event(c,'Payroll '||action_text,'payroll_run',run.id,jsonb_build_object('reason',reason_text));
end $$;
do $$declare t text;begin foreach t in array array['company_statutory_settings','payroll_runs','payroll_run_employees','payroll_run_components','payroll_approvals','payroll_lock_history']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
create policy statutory_rule_read on public.company_statutory_settings for select to authenticated using(public.has_permission(company_id,'salary.read')or public.has_permission(company_id,'settings.write'));
create policy run_read on public.payroll_runs for select to authenticated using(public.has_permission(company_id,'payroll.run')or public.has_permission(company_id,'salary.read'));
create policy run_employee_read on public.payroll_run_employees for select to authenticated using(public.has_permission(company_id,'payroll.run')or public.has_permission(company_id,'salary.read')or(public.is_member(company_id)and exists(select 1 from public.employees e where e.company_id=payroll_run_employees.company_id and e.id=payroll_run_employees.employee_id and e.user_id=auth.uid())));
create policy run_component_read on public.payroll_run_components for select to authenticated using(public.has_permission(company_id,'payroll.run')or public.has_permission(company_id,'salary.read'));
create policy approval_read on public.payroll_approvals for select to authenticated using(public.has_permission(company_id,'payroll.run'));
create policy lock_read on public.payroll_lock_history for select to authenticated using(public.has_permission(company_id,'payroll.run'));
revoke all on function public.validate_payroll(uuid,date),public.calculate_payroll(uuid,date),public.transition_payroll(uuid,date,text,integer,text)from public,anon,authenticated;
grant execute on function public.validate_payroll(uuid,date),public.calculate_payroll(uuid,date),public.transition_payroll(uuid,date,text,integer,text)to authenticated;
commit;
