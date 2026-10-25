-- Apply after upgrade-manual-salary-imports-kyc.sql. Existing snapshots/payments are retained.
begin;
alter table public.payroll_runs drop constraint payroll_runs_company_id_month_key;
alter table public.payroll_runs add column batch_number integer not null default 1;
alter table public.payroll_runs add constraint payroll_month_batch unique(company_id,month,batch_number);
alter table public.payroll_run_employees add column payroll_month date;
update public.payroll_run_employees e set payroll_month=r.month from public.payroll_runs r where r.company_id=e.company_id and r.id=e.run_id;
alter table public.payroll_run_employees alter column payroll_month set not null;
alter table public.payroll_run_employees add constraint employee_payroll_once_per_month unique(company_id,employee_id,payroll_month);
create function public.set_employee_payroll_month()returns trigger language plpgsql security definer set search_path=''as $$begin
 select month into new.payroll_month from public.payroll_runs where company_id=new.company_id and id=new.run_id;return new;end $$;
create trigger employee_payroll_month before insert or update on public.payroll_run_employees for each row execute function public.set_employee_payroll_month();
revoke all on function public.set_employee_payroll_month()from public,anon,authenticated;
create function public.employee_attendance_complete(c uuid,e uuid,m date)returns boolean language sql stable set search_path=''as $$
 select exists(select 1 from public.employees emp where emp.company_id=c and emp.id=e and emp.joining_date<m+interval '1 month' and(emp.exit_date is null or emp.exit_date>=m)and not exists(
 select 1 from generate_series(greatest(m,emp.joining_date),least((m+interval '1 month - 1 day')::date,coalesce(emp.exit_date,'infinity'::date)),interval '1 day')d where not exists(select 1 from public.attendance_records a where a.company_id=c and a.employee_id=e and a.date=d::date and a.status<>'Missing Punch')))
$$;
revoke all on function public.employee_attendance_complete(uuid,uuid,date)from public,anon,authenticated;
-- Retain the complete salary/statutory/calendar validation chain; scope its results per employee.
alter function public.validate_payroll(uuid,date)rename to validate_payroll_before_batches;
revoke all on function public.validate_payroll_before_batches(uuid,date)from public,anon,authenticated;
create function public.validate_payroll(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$
declare checks jsonb;issues jsonb;ready uuid[];blockers integer;begin
 perform public.require_permission(c,'payroll.run');
 if m is null or extract(day from m)<>1 then raise exception 'First day required'using errcode='22023';end if;
 checks:=public.validate_payroll_before_batches(c,m);
 select coalesce(jsonb_agg(case when issue->>'employeeId'<>''then issue||jsonb_build_object('severity','Warning','message',case when issue->>'check'='Attendance Missing'then 'Pending: complete attendance for this employee for the whole employment period in this month.'else issue->>'message'end)else issue end),'[]')into issues
 from jsonb_array_elements(checks->'issues')issue where issue->>'check'<>'Attendance Finalization'and not exists(select 1 from public.payroll_run_employees p where p.company_id=c and p.payroll_month=m and p.employee_id::text=issue->>'employeeId');
 select coalesce(array_agg(e.id),'{}')into ready from public.employees e where e.company_id=c and e.status not in('Inactive','Salary Hold')and public.employee_attendance_complete(c,e.id,m)
 and not exists(select 1 from public.payroll_run_employees p where p.company_id=c and p.payroll_month=m and p.employee_id=e.id)
 and not exists(select 1 from jsonb_array_elements(checks->'issues')i where i->>'employeeId'=e.id::text and i->>'severity'='Blocking Error'and i->>'check'<>'Attendance Missing');
 select count(*)into blockers from jsonb_array_elements(issues)i where i->>'severity'='Blocking Error';
 return checks||jsonb_build_object('issues',issues,'blockingErrors',blockers,'warnings',jsonb_array_length(issues)-blockers,'passed',cardinality(ready),'readyEmployeeIds',to_jsonb(ready),'readyCount',cardinality(ready),'calculatedCount',(select count(*)from public.payroll_run_employees where company_id=c and payroll_month=m));
end $$;
grant execute on function public.validate_payroll(uuid,date)to authenticated;
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
 validation:=public.validate_payroll(c,m);
 if(validation->>'blockingErrors')::integer>0 then raise exception 'Payroll validation failed'using errcode='23514';end if;
 select * into run from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1 for update;
 if(validation->>'readyCount')::integer=0 then
 if run.id is not null then return run.id;end if;
 raise exception 'No employees have complete attendance and salary setup for this month'using errcode='P0052';end if;
 if run.status='Approved'then raise exception 'Lock the approved batch before calculating the next batch'using errcode='P0052';end if;
 if run.id is null or run.status='Locked'then
 insert into public.payroll_runs(company_id,month,batch_number)values(c,m,coalesce(run.batch_number,0)+1)returning * into run;end if;

 if run.status not in('Draft','Calculated')then raise exception 'Payroll is approved or locked'using errcode='23514';end if;
 validation:=public.validate_payroll(c,m);if(validation->>'blockingErrors')::integer>0 then raise exception 'Payroll validation failed'using errcode='23514';end if;
 calendar_days:=finish-m+1;select coalesce(settings#>>'{payroll,proration}','calendar')into proration_mode from public.company_settings where company_id=c;proration_mode:=coalesce(proration_mode,'calendar');

 for emp in select * from public.employees where company_id=c and joining_date<=finish and(exit_date is null or exit_date>=m)and id in(select value::uuid from jsonb_array_elements_text(validation->'readyEmployeeIds'))order by id for update loop
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
  values(c,run.id,emp.id,gross,deduct,gross-deduct,cost,jsonb_build_object('setupWarnings',(select coalesce(jsonb_agg(issue),'[]'::jsonb) from jsonb_array_elements(validation->'issues')issue where issue->>'employeeId'=emp.id::text and issue->>'severity'='Warning'),'inputFingerprint',public.employee_payroll_fingerprint(c,emp.id,m),'employeeCode',emp.employee_code,'employeeName',emp.first_name||' '||emp.last_name,'departmentId',emp.department_id,'month',m,'calendarDays',calendar_days,'proration',proration_mode,'prorationDays',proration_days,'calendarBasis',jsonb_build_object('schedules',(select coalesce(jsonb_agg(to_jsonb(s)order by s.id),'[]')from public.work_schedules s where s.company_id=c and s.active and(s.employee_id=emp.id or s.employee_id is null)and s.effective_from<=finish and(s.effective_to is null or s.effective_to>=m)),'holidays',(select coalesce(jsonb_agg(to_jsonb(h)order by h.date),'[]')from public.holidays h where h.company_id=c and h.active and h.review_reference is not null and h.date between m and finish)),'paidDays',paid_days,'earnings',amounts,'deductions',deductions,'employer',employers,'ruleVersions',rules,'baselineGrossMinor',baseline_gross,'adjustments',(select coalesce(jsonb_agg(to_jsonb(a)order by a.id),'[]'::jsonb)from public.payroll_adjustments a where a.company_id=c and a.employee_id=emp.id and a.month=m and a.status='Reviewed'),'salary',salary_snapshot,'attendance',attendance_snapshot));
  for item in select key,value from jsonb_each_text(amounts)loop insert into public.payroll_run_components(company_id,run_id,employee_id,code,kind,amount_minor)values(c,run.id,emp.id,item.key,'earning',item.value::bigint);end loop;
  for item in select key,value from jsonb_each_text(deductions)loop insert into public.payroll_run_components(company_id,run_id,employee_id,code,kind,amount_minor,rule_id)values(c,run.id,emp.id,item.key,'deduction',item.value::bigint,(rules->>item.key)::uuid);end loop;
  for item in select key,value from jsonb_each_text(employers)loop insert into public.payroll_run_components(company_id,run_id,employee_id,code,kind,amount_minor,rule_id)values(c,run.id,emp.id,item.key,'employer',item.value::bigint,(rules->>item.key)::uuid);end loop;
 end loop;
 update public.payroll_runs set status='Calculated',version=version+1,calculated_by=auth.uid(),calculated_at=now()where company_id=c and id=run.id;
 insert into public.payroll_calculation_methods(company_id,run_id,run_version,method)select c,run.id,version,'exact-proration-v3-salary-carry'from public.payroll_runs where company_id=c and id=run.id;perform public.audit_event(c,'Payroll Calculated','payroll_run',run.id,jsonb_build_object('month',m));return run.id;
end $function$
;
CREATE OR REPLACE FUNCTION public.transition_payroll(c uuid, m date, action_text text, expected_version integer, reason_text text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare run public.payroll_runs;begin
 perform public.require_permission(c,case action_text when 'approve'then 'payroll.approve'when 'lock'then 'payroll.lock'when 'unlock'then 'payroll.unlock'else 'payroll.run'end);
 perform 1 from public.companies where id=c for update;select * into run from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1 for update;
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
end $function$
;
CREATE OR REPLACE FUNCTION public.generate_payslips(c uuid, m date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare run public.payroll_runs;n integer;company_name text;begin
 perform public.require_permission(c,'payroll.run');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1 for update;
 if not found or run.status<>'Locked'then raise exception 'Lock payroll before generating payslips'using errcode='23514';end if;
 select name into company_name from public.companies where id=c;
 insert into public.payslips(company_id,run_id,employee_id,month,run_version,content,generated_by)
 select c,run.id,employee_id,m,run.version,snapshot||jsonb_build_object('companyName',company_name,'grossMinor',gross_minor,'deductionMinor',deduction_minor,'netMinor',net_minor,'employerMinor',employer_minor),auth.uid()from public.payroll_run_employees where company_id=c and run_id=run.id
 on conflict(company_id,run_id,employee_id)do update set content=excluded.content,run_version=excluded.run_version,generated_at=now(),generated_by=auth.uid()where payslips.status='Draft';
 get diagnostics n=row_count;perform public.audit_event(c,'Payslips Generated','payroll_run',run.id,jsonb_build_object('count',n));return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.publish_payslips(c uuid, m date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare run public.payroll_runs;n integer;begin
 perform public.require_permission(c,'payroll.approve');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1 for update;
 if not found or run.status<>'Locked'then raise exception 'Lock payroll first'using errcode='23514';end if;
 if exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=run.id and not exists(select 1 from public.payslips p where p.company_id=c and p.run_id=run.id and p.employee_id=e.employee_id and p.run_version=run.version))then raise exception 'Generate current payslips first'using errcode='23514';end if;
 update public.payslips set status='Published',published_by=auth.uid(),published_at=now()where company_id=c and run_id=run.id and status='Draft'and run_version=run.version;
 get diagnostics n=row_count;perform public.audit_event(c,'Payslips Published','payroll_run',run.id,jsonb_build_object('count',n));return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.post_payroll_journal_internal(c uuid, m date, expected_version integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare run public.payroll_runs;lines_json jsonb:='[]';amount record;ledger uuid;rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into run from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1 for update;
 if not found or run.status<>'Locked'then raise exception 'Locked payroll required'using errcode='23514';end if;if run.version<>expected_version then raise exception 'Payroll changed'using errcode='40001';end if;
 if exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id)then raise exception 'Payroll already posted'using errcode='23514';end if;
 for amount in select 'salaryExpense'code,sum(gross_minor)total,true debit from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select 'employerExpense',sum(employer_minor),true from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select 'netPayable',sum(net_minor),false from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select case when code in('uniformAdvance','vehicleDamage','recovery')then 'otherDeduction'else code end,sum(amount_minor),false from public.payroll_run_components where company_id=c and run_id=run.id and kind in('deduction','employer')group by case when code in('uniformAdvance','vehicleDamage','recovery')then 'otherDeduction'else code end
 loop
  if amount.total>0 then
   select account_id into ledger from public.payroll_account_mappings where company_id=c and code=amount.code;
   if not found then raise exception 'Configure payroll account mappings before posting'using errcode='23514';end if;
   lines_json:=lines_json||jsonb_build_array(jsonb_build_object('accountId',ledger,'debitMinor',case when amount.debit then amount.total else 0 end,'creditMinor',case when amount.debit then 0 else amount.total end));
  end if;
 end loop;
 rid:=public.create_journal(c,jsonb_build_object('voucherNumber','PAY-'||to_char(m,'YYYY-MM')||'-B'||run.batch_number,'date',(m+interval '1 month - 1 day')::date,'type','Journal','narration','Payroll accrual '||to_char(m,'YYYY-MM'),'lines',lines_json));
 update public.journal_entries set source_type='payroll',source_id=run.id where company_id=c and id=rid;perform public.post_journal(c,rid,1);perform public.audit_event(c,'Payroll Journal Posted','payroll_run',run.id,jsonb_build_object('journalId',rid));return rid;
end $function$
;
CREATE OR REPLACE FUNCTION public.post_payroll_journal(c uuid, m date, expected_version integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare j uuid;r uuid;mappings jsonb;begin
 j:=public.post_payroll_journal_internal(c,m,expected_version);
 select id into r from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1;
 select jsonb_object_agg(code,account_id)into mappings from public.payroll_account_mappings where company_id=c;
 insert into public.payroll_posting_details values(c,r,j,mappings);return j;
end $function$
;
CREATE OR REPLACE FUNCTION public.prepare_disbursement(c uuid, m date, b uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare run public.payroll_runs;payable uuid;rid uuid;row record;bank public.employee_bank_details;n integer:=0;begin
 perform public.require_permission(c,'disbursements.write');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1 for update;
 if not found or run.status<>'Locked'then raise exception 'Locked payroll required'using errcode='23514';end if;
 if not exists(select 1 from public.bank_accounts where company_id=c and id=b and kind='Bank')then raise exception 'Company bank account required'using errcode='22023';end if;
 select(mapping_snapshot->>'netPayable')::uuid into payable from public.payroll_posting_details where company_id=c and run_id=run.id;
 if payable is null then raise exception 'Post payroll accrual before preparing payments'using errcode='23514';end if;
 if not exists(select 1 from public.ledger_accounts a join public.account_groups g on g.company_id=a.company_id and g.id=a.group_id where a.company_id=c and a.id=payable and a.status='Active'and g.type='Liability')then raise exception 'Payroll payable liability ledger required'using errcode='23514';end if;
 rid:=gen_random_uuid();insert into public.disbursement_batches(id,company_id,run_id,run_version,bank_id,payable_account_id,prepared_by)values(rid,c,run.id,run.version,b,payable,auth.uid());
 for row in select * from public.payroll_run_employees where company_id=c and run_id=run.id and net_minor>0 order by employee_id loop
  select * into bank from public.employee_bank_details where company_id=c and employee_id=row.employee_id;
  if bank.employee_id is null or bank.account_number=''or bank.ifsc_code=''or bank.account_holder_name=''or not exists(select 1 from public.employee_statutory_details s where s.company_id=c and s.employee_id=row.employee_id and s.bank_status='Verified')then raise exception 'Review and verify employee bank details before preparing payments'using errcode='23514';end if;
  insert into public.disbursement_items values(c,rid,row.employee_id,row.snapshot->>'employeeCode',row.snapshot->>'employeeName',row.net_minor,jsonb_build_object('accountHolderName',bank.account_holder_name,'accountNumber',bank.account_number,'ifscCode',bank.ifsc_code,'bankName',bank.bank_name));n:=n+1;
 end loop;
 if n=0 then raise exception 'No positive salary payments to prepare'using errcode='23514';end if;
 perform public.audit_event(c,'Payment Instructions Prepared','disbursement_batch',rid,jsonb_build_object('runId',run.id,'employees',n,'bankId',b));return rid;
end $function$
;
CREATE OR REPLACE FUNCTION public.payroll_workflow_status(c uuid, m date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare run public.payroll_runs;b public.disbursement_batches;published boolean:=false;paid boolean:=false;posted boolean:=false;begin
 perform public.require_permission(c,'payroll.run');select * into run from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1;
 if found then
 published:=exists(select 1 from public.payroll_run_employees where company_id=c and run_id=run.id)and not exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=run.id and not exists(select 1 from public.payslips p where p.company_id=c and p.run_id=run.id and p.employee_id=e.employee_id and p.run_version=run.version and p.status='Published'));
 posted:=exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id and status='Posted');
 select * into b from public.disbursement_batches where company_id=c and run_id=run.id and run_version=run.version and status='Prepared';
 if found then paid:=exists(select 1 from public.disbursement_items where company_id=c and batch_id=b.id)and not exists(select 1 from public.disbursement_items i where i.company_id=c and i.batch_id=b.id and i.amount_minor<>(select coalesce(sum(t.amount_minor),0)from public.disbursement_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.batch_id=b.id and p.employee_id=i.employee_id and t.status='Confirmed'));end if;
 end if;return jsonb_build_object('published',published,'disbursed',paid,'posted',posted);
end $function$
;
create function public.employee_payroll_fingerprint(c uuid,e uuid,m date)returns text language sql stable set search_path=''as $$
 select md5(jsonb_build_object('employee',(select to_jsonb(x)-'version'-'updated_at'from public.employees x where company_id=c and id=e),
 'salary',(select jsonb_agg(to_jsonb(x)order by id)from public.employee_salary_assignments x where company_id=c and employee_id=e),
 'values',(select jsonb_agg(to_jsonb(x)order by assignment_id,component_code)from public.employee_salary_component_values x where company_id=c and assignment_id in(select id from public.employee_salary_assignments where company_id=c and employee_id=e)),
 'attendance',(select jsonb_agg(to_jsonb(x)order by date)from public.attendance_records x where company_id=c and employee_id=e and date>=m and date<m+interval '1 month'),
 'stat',(select to_jsonb(x)-'bank_status'-'pan_status'from public.employee_statutory_details x where company_id=c and employee_id=e),
 'settings',(select settings from public.company_settings where company_id=c),
 'rules',(select jsonb_agg(to_jsonb(x)order by id)from public.company_statutory_settings x where company_id=c),
 'schedules',(select jsonb_agg(to_jsonb(x)order by id)from public.work_schedules x where company_id=c and(employee_id=e or employee_id is null)),
 'holidays',(select jsonb_agg(to_jsonb(x)order by id)from public.holidays x where company_id=c and date>=m and date<m+interval '1 month'),
 'adjustments',(select jsonb_agg(to_jsonb(x)order by id)from public.payroll_adjustments x where company_id=c and employee_id=e and month=m),
 'holds',(select jsonb_agg(to_jsonb(x)order by id)from public.salary_holds x where company_id=c and employee_id=e and month=m))::text)
$$;
revoke all on function public.employee_payroll_fingerprint(uuid,uuid,date)from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.check_payroll_revision()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare current_revision bigint;begin
 select payroll_input_version into current_revision from public.companies where id=new.company_id for update;
 if new.status='Calculated'and old.status in('Draft','Calculated')then
  new.input_version:=current_revision;
 elsif new.status='Approved'and old.status='Calculated'then
  if exists(select 1 from public.payroll_run_employees e where e.company_id=new.company_id and e.run_id=new.id and e.snapshot->>'inputFingerprint' is not null and e.snapshot->>'inputFingerprint'<>public.employee_payroll_fingerprint(new.company_id,e.employee_id,new.month))or(new.input_version is distinct from current_revision and exists(select 1 from public.payroll_run_employees e where e.company_id=new.company_id and e.run_id=new.id and e.snapshot->>'inputFingerprint'is null))then raise exception 'Payroll inputs changed; recalculate before approval'using errcode='40001';end if;
 end if;
 return new;
end $function$
;
CREATE OR REPLACE FUNCTION public.save_attendance_before_aliases(c uuid, rows_json jsonb, reason_text text, allow_update boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p jsonb; d date; e uuid; affected integer:=0; m date;
begin
 perform public.require_permission(c,'attendance.write');
 if length(trim(reason_text))<1 or jsonb_typeof(rows_json)<>'array' or jsonb_array_length(rows_json)not between 1 and 1000 then raise exception 'Reason and rows required' using errcode='22023';end if;
 -- Serialize with finalization. Every write locks the company before period rows.
 perform 1 from public.companies where id=c for update;
 for p in select value from jsonb_array_elements(rows_json)loop
  d:=(p->>'date')::date;e:=(p->>'employeeId')::uuid;m:=date_trunc('month',d)::date;
  insert into public.attendance_periods(company_id,month)values(c,m)on conflict do nothing;
  if exists(select 1 from public.payroll_run_employees where company_id=c and employee_id=e and payroll_month=m)then raise exception 'Attendance already used in calculated payroll; reset the month or use a payroll correction'using errcode='23514';end if;
  if exists(select 1 from public.attendance_periods where company_id=c and month=m and finalized_at is not null)and not exists(select 1 from public.payroll_runs where company_id=c and month=m)then raise exception 'Attendance finalized' using errcode='23514';end if;
  if not exists(select 1 from public.employees where company_id=c and id=e and joining_date<=d and(exit_date is null or exit_date>=d))then raise exception 'Employee/date invalid' using errcode='22023';end if;
  if not allow_update and exists(select 1 from public.attendance_records where company_id=c and employee_id=e and date=d)then raise exception 'Duplicate attendance import' using errcode='23505';end if;
  insert into public.attendance_records(company_id,employee_id,date,status,shift,check_in,check_out,work_minutes,overtime_minutes,leave_type,remarks,source,modified_by)
  values(c,e,d,p->>'status',coalesce(p->>'shift',''),nullif(p->>'checkIn','')::time,nullif(p->>'checkOut','')::time,coalesce((p->>'workMinutes')::integer,0),coalesce((p->>'overtimeMinutes')::integer,0),coalesce(p->>'leaveType',''),coalesce(p->>'remarks',''),'Manual',auth.uid())
  on conflict(company_id,employee_id,date)do update set status=excluded.status,shift=excluded.shift,check_in=excluded.check_in,check_out=excluded.check_out,work_minutes=excluded.work_minutes,overtime_minutes=excluded.overtime_minutes,leave_type=excluded.leave_type,remarks=excluded.remarks,modified_by=auth.uid(),modified_at=now();
  perform public.audit_event(c,'Attendance Modified','employee',e,jsonb_build_object('date',d,'reason',reason_text));affected:=affected+1;
 end loop;return affected;
end $function$
;
CREATE OR REPLACE FUNCTION public.save_client_payroll_costs(c uuid, e uuid, m date, expected_version integer, payroll_version integer, p jsonb, note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare run public.payroll_runs;old_version integer;item record;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and month=m and id in(select run_id from public.payroll_run_employees where company_id=c and employee_id=e) for update;
 if not found or payroll_version is null or expected_version is null or expected_version<0 or m is null or e is null or run.status='Draft'or run.version<>payroll_version then raise exception 'Payroll changed; refresh the client salary sheet'using errcode='40001';end if;
 if not exists(select 1 from public.payroll_run_employees where company_id=c and run_id=run.id and employee_id=e)then raise exception 'Employee outside calculated payroll'using errcode='P0002';end if;
 select version into old_version from public.payroll_client_costs where company_id=c and employee_id=e and month=m;
 if coalesce(old_version,0)<>expected_version then raise exception 'Client cost review changed; refresh'using errcode='40001';end if;
 if p is null or jsonb_typeof(p)<>'object'or octet_length(p::text)>10000 then raise exception 'Invalid client cost inputs'using errcode='22023';end if;
 for item in select key,value from jsonb_each_text(p)loop
 if item.key not in('employerEpf','employerEps','edli','pfAdmin','insurance','serviceCharge','gratuity','invoiceValue')or item.value is null or item.value!~'^[0-9]+$'or item.value::numeric>9000000000000 then raise exception 'Invalid reviewed client cost amount'using errcode='22023';end if;
 end loop;
 insert into public.payroll_client_costs(company_id,employee_id,month,amounts,payroll_version,reviewed_by,review_note)values(c,e,m,p,run.version,auth.uid(),note)
 on conflict(company_id,employee_id,month)do update set amounts=excluded.amounts,payroll_version=excluded.payroll_version,version=payroll_client_costs.version+1,reviewed_by=excluded.reviewed_by,review_note=excluded.review_note,updated_at=now();
 perform public.audit_event(c,'Client Payroll Costs Reviewed','employee',e,jsonb_build_object('month',m,'payrollVersion',run.version,'amounts',p,'note',note));
end $function$
;
CREATE OR REPLACE FUNCTION public.review_prior_payroll_correction(c uuid, p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare run public.payroll_runs;old_row public.payroll_run_employees;e uuid;m date;rid uuid;begin
 perform public.require_permission(c,'salary.write');perform public.require_permission(c,'payroll.run');perform 1 from public.companies where id=c for update;
 e:=(p->>'employeeId')::uuid;m:=(p->>'month')::date;
 select * into run from public.payroll_runs where company_id=c and month=(p->>'sourceMonth')::date and id in(select run_id from public.payroll_run_employees where company_id=c and employee_id=e) for update;
 if run.id is null or run.status<>'Locked'or not(exists(select 1 from public.payslips where company_id=c and run_id=run.id and employee_id=e and run_version=run.version and status='Published')or exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id and status='Posted'))then raise exception 'Published or posted locked source payroll required'using errcode='23514';end if;
 if(p->>'sourceVersion')is null or run.version<>(p->>'sourceVersion')::integer then raise exception 'Source payroll changed; refresh'using errcode='40001';end if;
 if m is null or extract(day from m)<>1 or m<=run.month or p->>'kind'is null or p->>'kind'not in('arrears','otherDeduction')or(p->>'amountMinor')is null or(p->>'amountMinor')::bigint<=0 then raise exception 'Later payroll month and positive reviewed correction required'using errcode='22023';end if;
 select * into old_row from public.payroll_run_employees where company_id=c and run_id=run.id and employee_id=e;
 if not found then raise exception 'Source employee snapshot not found'using errcode='P0002';end if;
 if not exists(select 1 from public.employees where company_id=c and id=e and joining_date<=m+interval '1 month - 1 day'and(exit_date is null or exit_date>=m)and status not in('Inactive','Salary Hold'))then raise exception 'Correction employee must be eligible in the later payroll month'using errcode='23514';end if;
 rid:=public.save_payroll_adjustment(c,jsonb_build_object('employeeId',e,'month',m,'kind',p->>'kind','amountMinor',p->>'amountMinor','reference',p->>'reference','reviewNote',p->>'reviewNote','overtimeMinutes',0));
 update public.payroll_adjustments set source_run_id=run.id,source_run_version=run.version,source_snapshot=jsonb_build_object('month',run.month,'employeeCode',old_row.snapshot->>'employeeCode','employeeName',old_row.snapshot->>'employeeName','grossMinor',old_row.gross_minor,'deductionMinor',old_row.deduction_minor,'netMinor',old_row.net_minor,'earnings',old_row.snapshot->'earnings','deductions',old_row.snapshot->'deductions','employer',old_row.snapshot->'employer','ruleVersions',old_row.snapshot->'ruleVersions')where company_id=c and id=rid;
 perform public.audit_event(c,'Prior Payroll Correction Reviewed','employee',e,jsonb_build_object('sourceRunId',run.id,'sourceVersion',run.version,'adjustmentId',rid,'targetMonth',m,'reference',p->>'reference'));return rid;
end $function$
;
CREATE OR REPLACE FUNCTION public.post_payroll_batch(c uuid, selected_run uuid, expected_version integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare m date;run public.payroll_runs;lines_json jsonb:='[]';amount record;ledger uuid;rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into run from public.payroll_runs where company_id=c and id=selected_run for update;m:=run.month;
 if not found or run.status<>'Locked'then raise exception 'Locked payroll required'using errcode='23514';end if;if run.version<>expected_version then raise exception 'Payroll changed'using errcode='40001';end if;
 if exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id)then raise exception 'Payroll already posted'using errcode='23514';end if;
 for amount in select 'salaryExpense'code,sum(gross_minor)total,true debit from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select 'employerExpense',sum(employer_minor),true from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select 'netPayable',sum(net_minor),false from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select case when code in('uniformAdvance','vehicleDamage','recovery')then 'otherDeduction'else code end,sum(amount_minor),false from public.payroll_run_components where company_id=c and run_id=run.id and kind in('deduction','employer')group by case when code in('uniformAdvance','vehicleDamage','recovery')then 'otherDeduction'else code end
 loop
  if amount.total>0 then
   select account_id into ledger from public.payroll_account_mappings where company_id=c and code=amount.code;
   if not found then raise exception 'Configure payroll account mappings before posting'using errcode='23514';end if;
   lines_json:=lines_json||jsonb_build_array(jsonb_build_object('accountId',ledger,'debitMinor',case when amount.debit then amount.total else 0 end,'creditMinor',case when amount.debit then 0 else amount.total end));
  end if;
 end loop;
 rid:=public.create_journal(c,jsonb_build_object('voucherNumber','PAY-'||to_char(m,'YYYY-MM')||'-B'||run.batch_number,'date',(m+interval '1 month - 1 day')::date,'type','Journal','narration','Payroll accrual '||to_char(m,'YYYY-MM'),'lines',lines_json));
 update public.journal_entries set source_type='payroll',source_id=run.id where company_id=c and id=rid;perform public.post_journal(c,rid,1);perform public.audit_event(c,'Payroll Journal Posted','payroll_run',run.id,jsonb_build_object('journalId',rid));insert into public.payroll_posting_details(company_id,run_id,journal_id,mapping_snapshot)select c,run.id,rid,jsonb_object_agg(code,account_id)from public.payroll_account_mappings where company_id=c;return rid;
end $function$
;
CREATE OR REPLACE FUNCTION public.prepare_disbursement_for_run(c uuid, selected_run uuid, b uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare run public.payroll_runs;payable uuid;rid uuid;row record;bank public.employee_bank_details;n integer:=0;begin
 perform public.require_permission(c,'disbursements.write');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and id=selected_run for update;
 if not found or run.status<>'Locked'then raise exception 'Locked payroll required'using errcode='23514';end if;
 if not exists(select 1 from public.bank_accounts where company_id=c and id=b and kind='Bank')then raise exception 'Company bank account required'using errcode='22023';end if;
 select(mapping_snapshot->>'netPayable')::uuid into payable from public.payroll_posting_details where company_id=c and run_id=run.id;
 if payable is null then raise exception 'Post payroll accrual before preparing payments'using errcode='23514';end if;
 if not exists(select 1 from public.ledger_accounts a join public.account_groups g on g.company_id=a.company_id and g.id=a.group_id where a.company_id=c and a.id=payable and a.status='Active'and g.type='Liability')then raise exception 'Payroll payable liability ledger required'using errcode='23514';end if;
 rid:=gen_random_uuid();insert into public.disbursement_batches(id,company_id,run_id,run_version,bank_id,payable_account_id,prepared_by)values(rid,c,run.id,run.version,b,payable,auth.uid());
 for row in select * from public.payroll_run_employees where company_id=c and run_id=run.id and net_minor>0 order by employee_id loop
  select * into bank from public.employee_bank_details where company_id=c and employee_id=row.employee_id;
  if bank.employee_id is null or bank.account_number=''or bank.ifsc_code=''or bank.account_holder_name=''or not exists(select 1 from public.employee_statutory_details s where s.company_id=c and s.employee_id=row.employee_id and s.bank_status='Verified')then raise exception 'Review and verify employee bank details before preparing payments'using errcode='23514';end if;
  insert into public.disbursement_items values(c,rid,row.employee_id,row.snapshot->>'employeeCode',row.snapshot->>'employeeName',row.net_minor,jsonb_build_object('accountHolderName',bank.account_holder_name,'accountNumber',bank.account_number,'ifscCode',bank.ifsc_code,'bankName',bank.bank_name));n:=n+1;
 end loop;
 if n=0 then raise exception 'No positive salary payments to prepare'using errcode='23514';end if;
 perform public.audit_event(c,'Payment Instructions Prepared','disbursement_batch',rid,jsonb_build_object('runId',run.id,'employees',n,'bankId',b));return rid;
end $function$
;
revoke all on function public.post_payroll_batch(uuid,uuid,integer),public.prepare_disbursement_for_run(uuid,uuid,uuid)from public,anon,authenticated;grant execute on function public.post_payroll_batch(uuid,uuid,integer),public.prepare_disbursement_for_run(uuid,uuid,uuid)to authenticated;
CREATE OR REPLACE FUNCTION public.disbursement_batch_by_id(c uuid, selected_batch uuid, include_bank_details boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare batch public.disbursement_batches;items jsonb;payments jsonb;begin
 perform public.require_permission(c,'disbursements.write');
 select b.* into batch from public.disbursement_batches b join public.payroll_runs r on r.company_id=b.company_id and r.id=b.run_id where b.company_id=c and b.id=selected_batch and b.status='Prepared';
 if not found then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('employeeId',i.employee_id,'employeeCode',i.employee_code,'employeeName',i.employee_name,'amountMinor',i.amount_minor,'paidMinor',coalesce((select sum(t.amount_minor)from public.disbursement_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.batch_id=batch.id and p.employee_id=i.employee_id and t.status='Confirmed'),0),'bank',case when include_bank_details then i.bank_snapshot else i.bank_snapshot||jsonb_build_object('accountNumber','••••'||right(i.bank_snapshot->>'accountNumber',4))end)order by i.employee_code),'[]'::jsonb)into items from public.disbursement_items i where i.company_id=c and i.batch_id=batch.id;
 select coalesce(jsonb_agg(jsonb_build_object('employeeId',p.employee_id,'transactionId',t.id,'amountMinor',t.amount_minor,'date',t.date,'reference',t.reference,'status',t.status)order by t.confirmed_at),'[]'::jsonb)into payments from public.disbursement_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.batch_id=batch.id;
 return jsonb_build_object('id',batch.id,'runId',batch.run_id,'runVersion',batch.run_version,'bankId',batch.bank_id,'preparedAt',batch.prepared_at,'items',items,'payments',payments);
end $function$
;
create or replace function public.disbursement_batch(c uuid,m date,include_bank_details boolean default false)returns jsonb language plpgsql security definer set search_path=''as $$declare b uuid;begin
 perform public.require_permission(c,'disbursements.write');
 select d.id into b from public.disbursement_batches d join public.payroll_runs r on r.company_id=d.company_id and r.id=d.run_id where d.company_id=c and r.month=m and d.status='Prepared'order by r.batch_number desc limit 1;
 if b is null then return null;end if;return public.disbursement_batch_by_id(c,b,include_bank_details);end $$;
create function public.list_month_payment_batches(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'disbursements.write');return(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'runId',r.id,'batchNumber',r.batch_number,'preparedAt',b.prepared_at)order by r.batch_number desc),'[]')from public.disbursement_batches b join public.payroll_runs r on r.company_id=b.company_id and r.id=b.run_id where b.company_id=c and r.month=m and b.status='Prepared');end $$;
revoke all on function public.disbursement_batch_by_id(uuid,uuid,boolean),public.list_month_payment_batches(uuid,date)from public,anon,authenticated;
grant execute on function public.disbursement_batch_by_id(uuid,uuid,boolean),public.list_month_payment_batches(uuid,date)to authenticated;
create function public.month_employee_payroll_status(c uuid,m date)returns jsonb language plpgsql stable security definer set search_path=''as $$begin
 perform public.require_permission(c,'attendance.read');return(select coalesce(jsonb_agg(jsonb_build_object('employeeId',p.employee_id,'status',r.status,'batchNumber',r.batch_number,'calculatedAt',r.calculated_at)),'[]')from public.payroll_run_employees p join public.payroll_runs r on r.company_id=p.company_id and r.id=p.run_id where p.company_id=c and p.payroll_month=m);end $$;
revoke all on function public.month_employee_payroll_status(uuid,date)from public,anon,authenticated;grant execute on function public.month_employee_payroll_status(uuid,date)to authenticated;
CREATE OR REPLACE FUNCTION public.import_client_payroll_costs(c uuid, m date, payroll_version integer, rows_json jsonb, note text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare row_data jsonb;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 500 or octet_length(rows_json::text)>1000000 then raise exception 'Invalid client cost import size'using errcode='22023';end if;
 if(select count(distinct value->>'employeeId')from jsonb_array_elements(rows_json))<>jsonb_array_length(rows_json)then raise exception 'Duplicate client cost employee'using errcode='22023';end if;
 if payroll_version is distinct from(select version from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1)then raise exception 'Payroll changed; refresh the client salary sheet'using errcode='40001';end if; for row_data in select value from jsonb_array_elements(rows_json)loop perform public.save_client_payroll_costs(c,(row_data->>'employeeId')::uuid,m,(row_data->>'expectedVersion')::integer,(select r.version from public.payroll_runs r join public.payroll_run_employees e on e.company_id=r.company_id and e.run_id=r.id where r.company_id=c and r.month=m and e.employee_id=(row_data->>'employeeId')::uuid),row_data->'amounts',note);end loop;
 return jsonb_array_length(rows_json);
end $function$
;
CREATE OR REPLACE FUNCTION public.save_payroll_adjustment(c uuid, p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare a uuid;e uuid;m date;v integer;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;a:=nullif(p->>'id','')::uuid;
 if a is not null then select employee_id,month,version into e,m,v from public.payroll_adjustments where company_id=c and id=a for update;if not found then raise exception 'Adjustment not found'using errcode='P0002';end if;
 if(p->>'expectedVersion')is null or v<>(p->>'expectedVersion')::integer then raise exception 'Adjustment changed; refresh'using errcode='40001';end if;
 else e:=(p->>'employeeId')::uuid;m:=(p->>'month')::date;end if;
 if exists(select 1 from public.payroll_run_employees where company_id=c and payroll_month=m and employee_id=e)then raise exception 'Approved payroll adjustments are protected'using errcode='23514';end if;
 if not exists(select 1 from public.employees where company_id=c and id=e and joining_date<=m+interval '1 month - 1 day'and(exit_date is null or exit_date>=m))then raise exception 'Employee outside payroll employment period'using errcode='23514';end if;
 if a is null then
 if p->>'kind'<>'overtime'and coalesce((p->>'overtimeMinutes')::integer,0)<>0 then raise exception 'Overtime minutes require overtime adjustment'using errcode='22023';end if;
 insert into public.payroll_adjustments(company_id,employee_id,month,kind,amount_minor,overtime_minutes,reference,review_note,reviewed_by)values(c,e,m,p->>'kind',(p->>'amountMinor')::bigint,coalesce((p->>'overtimeMinutes')::integer,0),p->>'reference',p->>'reviewNote',auth.uid())returning id into a;
 else if length(trim(coalesce(p->>'reason','')))not between 1 and 2000 then raise exception 'Adjustment correction reason required'using errcode='22023';end if;update public.payroll_adjustments set status='Cancelled',version=version+1 where company_id=c and id=a and status='Reviewed';if not found then raise exception 'Adjustment already cancelled'using errcode='23514';end if;end if;
 perform public.audit_event(c,'Payroll Adjustment Reviewed','employee',e,jsonb_build_object('adjustmentId',a,'month',m,'kind',p->>'kind','reference',p->>'reference','reason',p->>'reason'));return a;
end $function$
;
create or replace function public.payroll_workflow_status(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$declare published boolean;paid boolean;posted boolean;has_rows boolean;begin
 perform public.require_permission(c,'payroll.run');
 select exists(select 1 from public.payroll_run_employees where company_id=c and payroll_month=m)into has_rows;
 published:=has_rows and not exists(select 1 from public.payroll_run_employees e join public.payroll_runs r on r.company_id=e.company_id and r.id=e.run_id where e.company_id=c and e.payroll_month=m and not exists(select 1 from public.payslips p where p.company_id=c and p.run_id=r.id and p.employee_id=e.employee_id and p.run_version=r.version and p.status='Published'));
 posted:=has_rows and not exists(select 1 from public.payroll_runs r where r.company_id=c and r.month=m and exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=r.id and(e.gross_minor>0 or e.employer_minor>0))and not exists(select 1 from public.journal_entries j where j.company_id=c and j.source_type='payroll'and j.source_id=r.id and j.status='Posted'));
 paid:=has_rows and not exists(select 1 from public.payroll_run_employees e join public.payroll_runs r on r.company_id=e.company_id and r.id=e.run_id where e.company_id=c and e.payroll_month=m and(e.net_minor<>(select coalesce(sum(t.amount_minor),0)from public.disbursement_batches b join public.disbursement_payments p on p.company_id=b.company_id and p.batch_id=b.id join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where b.company_id=c and b.run_id=r.id and b.run_version=r.version and b.status='Prepared'and p.employee_id=e.employee_id and t.status='Confirmed')or r.status<>'Locked'));
 return jsonb_build_object('published',published,'posted',posted,'disbursed',paid);end $$;
CREATE OR REPLACE FUNCTION public.generate_payslips_for_run(c uuid, selected_run uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare m date;run public.payroll_runs;n integer;company_name text;begin
 perform public.require_permission(c,'payroll.run');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and id=selected_run for update;m:=run.month;
 if not found or run.status<>'Locked'then raise exception 'Lock payroll before generating payslips'using errcode='23514';end if;
 select name into company_name from public.companies where id=c;
 insert into public.payslips(company_id,run_id,employee_id,month,run_version,content,generated_by)
 select c,run.id,employee_id,m,run.version,snapshot||jsonb_build_object('companyName',company_name,'grossMinor',gross_minor,'deductionMinor',deduction_minor,'netMinor',net_minor,'employerMinor',employer_minor),auth.uid()from public.payroll_run_employees where company_id=c and run_id=run.id
 on conflict(company_id,run_id,employee_id)do update set content=excluded.content,run_version=excluded.run_version,generated_at=now(),generated_by=auth.uid()where payslips.status='Draft';
 get diagnostics n=row_count;perform public.audit_event(c,'Payslips Generated','payroll_run',run.id,jsonb_build_object('count',n));return n;
end $function$
;
revoke all on function public.generate_payslips_for_run(uuid,uuid)from public,anon,authenticated;
create or replace function public.generate_payslips(c uuid,m date)returns integer language plpgsql security definer set search_path=''as $$declare r uuid;n integer:=0;begin perform public.require_permission(c,'payroll.run');perform 1 from public.companies where id=c for update;for r in select id from public.payroll_runs where company_id=c and month=m and status='Locked'order by batch_number loop n:=n+public.generate_payslips_for_run(c,r);end loop;return n;end $$;
CREATE OR REPLACE FUNCTION public.publish_payslips_for_run(c uuid, selected_run uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare m date;run public.payroll_runs;n integer;begin
 perform public.require_permission(c,'payroll.approve');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and id=selected_run for update;m:=run.month;
 if not found or run.status<>'Locked'then raise exception 'Lock payroll first'using errcode='23514';end if;
 if exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=run.id and not exists(select 1 from public.payslips p where p.company_id=c and p.run_id=run.id and p.employee_id=e.employee_id and p.run_version=run.version))then raise exception 'Generate current payslips first'using errcode='23514';end if;
 update public.payslips set status='Published',published_by=auth.uid(),published_at=now()where company_id=c and run_id=run.id and status='Draft'and run_version=run.version;
 get diagnostics n=row_count;perform public.audit_event(c,'Payslips Published','payroll_run',run.id,jsonb_build_object('count',n));return n;
end $function$
;
revoke all on function public.publish_payslips_for_run(uuid,uuid)from public,anon,authenticated;
create or replace function public.publish_payslips(c uuid,m date)returns integer language plpgsql security definer set search_path=''as $$declare r uuid;n integer:=0;begin perform public.require_permission(c,'payroll.approve');perform 1 from public.companies where id=c for update;for r in select id from public.payroll_runs where company_id=c and month=m and status='Locked'order by batch_number loop n:=n+public.publish_payslips_for_run(c,r);end loop;return n;end $$;
CREATE OR REPLACE FUNCTION public.month_reset_context(c uuid, m date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare r uuid[];b uuid[];p uuid[];j uuid[];begin
 select coalesce(array_agg(id),'{}')into r from public.payroll_runs where company_id=c and month=m;
 select coalesce(array_agg(id order by id),'{}')into b from public.disbursement_batches where company_id=c and run_id=any(r);
 select coalesce(array_agg(transaction_id order by transaction_id),'{}')into p from public.disbursement_payments where company_id=c and batch_id=any(b);
 with recursive journals(id)as(
  select id from public.journal_entries where company_id=c and(source_type='payroll'and source_id=any(r) or id in(select journal_id from public.payroll_posting_details where company_id=c and run_id=any(r))or id in(select journal_id from public.bank_transactions where company_id=c and id=any(p)))
  union select e.id from public.journal_entries e join journals parent on e.reversal_of=parent.id where e.company_id=c
 )select coalesce(array_agg(id order by id),'{}')into j from journals;
 select coalesce(array_agg(id order by id),'{}')into p from public.bank_transactions where company_id=c and(id=any(p)or journal_id=any(j));
 return jsonb_build_object('run',r[1],'runs',r,'batches',b,'payments',p,'journals',j);
end $function$
;
CREATE OR REPLACE FUNCTION public.attendance_month_delete_preview(c uuid, m date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ctx jsonb;r uuid;n integer;rev bigint;blocked text;finalized boolean;counts jsonb;begin
 perform public.require_permission(c,'attendance.delete');
 if m is null or extract(day from m)<>1 then raise exception 'First day required'using errcode='22023';end if;
 ctx:=public.month_reset_context(c,m);r:=(ctx->>'run')::uuid;
 select payroll_input_version into rev from public.companies where id=c;
 select count(*)into n from public.attendance_records where company_id=c and date>=m and date<m+interval '1 month';
 select exists(select 1 from public.attendance_periods where company_id=c and month=m and finalized_at is not null)into finalized;
 if r is not null and not public.has_permission(c,'payroll.reset')then blocked:='A payroll administrator with month-reset permission must reset this month.';end if;
 if exists(select 1 from public.payroll_adjustments where company_id=c and source_run_id in(select value::uuid from jsonb_array_elements_text(ctx->'runs')) and month<>m)then blocked:='Another month contains a correction linked to this payroll. Remove that correction before resetting its source month.';end if;
 if exists(select 1 from public.invoice_payments where company_id=c and transaction_id in(select value::uuid from jsonb_array_elements_text(ctx->'payments')))or exists(select 1 from public.invoices where company_id=c and journal_id in(select value::uuid from jsonb_array_elements_text(ctx->'journals')))or exists(select 1 from public.invoice_notes where company_id=c and journal_id in(select value::uuid from jsonb_array_elements_text(ctx->'journals')))then blocked:='A linked journal is used by an invoice. Resolve that dependency before resetting this month.';end if;
 counts:=jsonb_build_object('salaryRows',(select count(*)from public.payroll_run_employees where company_id=c and run_id in(select value::uuid from jsonb_array_elements_text(ctx->'runs'))),'attempts',(select count(*)from public.salary_payment_attempts where company_id=c and batch_id in(select value::uuid from jsonb_array_elements_text(ctx->'batches'))),'payslips',(select count(*)from public.payslips where company_id=c and run_id in(select value::uuid from jsonb_array_elements_text(ctx->'runs'))),'payments',jsonb_array_length(ctx->'payments'),'journals',jsonb_array_length(ctx->'journals'),'adjustments',(select count(*)from public.payroll_adjustments where company_id=c and month=m));
 return jsonb_build_object('month',to_char(m,'YYYY-MM'),'count',n,'revision',md5(rev::text||ctx::text||counts::text||coalesce((select jsonb_agg(to_jsonb(pr)order by pr.id)::text from public.payroll_runs pr where pr.company_id=c and pr.month=m),'')),'blockedReason',blocked,'hasPayroll',r is not null,'finalized',finalized,'counts',counts,'hasData',n>0 or r is not null or finalized or(counts->>'adjustments')::int>0 or exists(select 1 from public.salary_holds where company_id=c and month=m),'resetsPayrollPreview',r is not null);
end $function$
;
CREATE OR REPLACE FUNCTION public.reset_attendance_payroll_month(c uuid, m date, expected_revision text, expected_count integer, remark text, confirm_payroll boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ctx jsonb;preview jsonb;r uuid;b uuid[];p uuid[];j uuid[];slips uuid[];recs uuid[];archive uuid;backup jsonb:='{}';t text;condition text;rows jsonb;n integer;begin
 perform public.require_permission(c,'attendance.delete');perform 1 from public.companies where id=c for update;perform public.require_permission(c,'attendance.delete');
 remark:=regexp_replace(coalesce(remark,''),'^[[:space:]]+|[[:space:]]+$','','g');
 if length(remark)not between 3 and 1000 then raise exception 'A reset remark of 3 to 1000 characters is required'using errcode='22023';end if;
 preview:=public.attendance_month_delete_preview(c,m);
 if preview->>'blockedReason'is not null then raise exception '%',preview->>'blockedReason'using errcode='P0050';end if;
 if (preview->>'hasPayroll')::boolean then perform public.require_permission(c,'payroll.reset');if confirm_payroll is distinct from true then raise exception 'Confirm removal of payroll, payslips and recorded payment entries for this month.'using errcode='P0050';end if;end if;
 if expected_revision is null or expected_count is null or expected_revision<>preview->>'revision'or expected_count<>(preview->>'count')::integer then raise exception 'Month changed; review the reset again'using errcode='40001';end if;
 ctx:=public.month_reset_context(c,m);r:=(ctx->>'run')::uuid;
 select coalesce(array_agg(value::uuid),'{}')into b from jsonb_array_elements_text(ctx->'batches');
 select coalesce(array_agg(value::uuid),'{}')into p from jsonb_array_elements_text(ctx->'payments');
 select coalesce(array_agg(value::uuid),'{}')into j from jsonb_array_elements_text(ctx->'journals');
 select coalesce(array_agg(id order by id),'{}')into slips from public.payslips where company_id=c and run_id in(select value::uuid from jsonb_array_elements_text(ctx->'runs'));
 select coalesce(array_agg(distinct reconciliation_id),'{}')into recs from public.bank_reconciliation_matches where company_id=c and journal_id=any(j);
 -- Archive and delete in FK order; foreign keys and all normal protection triggers stay enabled.
 foreach t in array array['notifications','bank_reconciliation_matches','cash_flow_review_history','cash_flow_reviews','disbursement_payments','salary_payment_attempts','disbursement_items','disbursement_batches','bank_transactions','payroll_posting_details','journal_lines','journal_entries','payslips','payroll_adjustments','salary_holds','payroll_client_costs','payroll_run_components','payroll_run_employees','payroll_approvals','payroll_lock_history','payroll_calculation_methods','payroll_runs','attendance_records','attendance_periods']loop
  condition:=case
   when t='notifications'then 'event_key in(select ''payslip:''||x::text from unnest($7)x)'
   when t in('bank_reconciliation_matches','cash_flow_review_history','cash_flow_reviews')then 'journal_id=any($6)'
   when t in('disbursement_payments','salary_payment_attempts','disbursement_items')then 'batch_id=any($4)'
   when t='disbursement_batches'then 'id=any($4)'
   when t='bank_transactions'then 'id=any($5)'
   when t='journal_lines'then 'entry_id=any($6)'
   when t='journal_entries'then 'id=any($6)'
   when t='payroll_runs'then 'month=$2'
   when t in('payroll_adjustments','salary_holds','payroll_client_costs','attendance_periods')then 'month=$2'
   when t='attendance_records'then 'date>=$2 and date<$2+interval ''1 month'''
   else 'run_id in(select id from public.payroll_runs where company_id=$1 and month=$2)'end;
  execute format('select coalesce(jsonb_agg(to_jsonb(row)),''[]'')from public.%I row where company_id=$1 and (%s)',t,condition)into rows using c,m,r,b,p,j,slips;
  backup:=backup||jsonb_build_object(t,rows);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(rec)),'[]')into rows from public.bank_reconciliations rec where company_id=c and id=any(recs);backup:=backup||jsonb_build_object('bank_reconciliations',rows);
 if to_regclass('public.attendance_master_matches')is not null then
  execute 'select coalesce(jsonb_agg(to_jsonb(row)),''[]'')from public.attendance_master_matches row where company_id=$1 and date>=$2 and date<$2+interval ''1 month'''into rows using c,m;
  backup:=backup||jsonb_build_object('attendance_master_matches',rows);
  execute 'delete from public.attendance_master_matches where company_id=$1 and date>=$2 and date<$2+interval ''1 month'''using c,m;
 end if;
 insert into public.payroll_month_reset_archives(company_id,month,actor_id,remark,snapshot)values(c,m,auth.uid(),remark,backup)returning id into archive;
 foreach t in array array['notifications','bank_reconciliation_matches','cash_flow_review_history','cash_flow_reviews','disbursement_payments','salary_payment_attempts','disbursement_items','disbursement_batches','bank_transactions','payroll_posting_details','journal_lines','journal_entries','payslips','payroll_adjustments','salary_holds','payroll_client_costs','payroll_run_components','payroll_run_employees','payroll_approvals','payroll_lock_history','payroll_calculation_methods','payroll_runs','attendance_records','attendance_periods']loop
  -- The archived row image is an exact, company-scoped deletion set.
  execute format('delete from public.%I row where row.company_id=$1 and to_jsonb(row)in(select value from jsonb_array_elements($2))',t)using c,backup->t;
 end loop;
 update public.bank_reconciliations set status='Open',version=version+1,reviewed_by=null,reviewed_at=null where company_id=c and id=any(recs);
 update public.companies set payroll_input_version=payroll_input_version+1 where id=c;
 n:=(preview->>'count')::integer;
 perform public.audit_event(c,'Attendance and Payroll Month Reset','company',c,jsonb_build_object('month',m,'reason',remark,'archiveId',archive,'attendanceDeleted',n,'removedCounts',preview->'counts'));
 return n;
end $function$
;
notify pgrst,'reload schema';
commit;
