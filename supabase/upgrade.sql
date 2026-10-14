-- Additive upgrade for projects that already applied setup.sql (001 and 002).
-- Apply once in the SQL Editor as the database owner. Existing company/auth records are retained.
begin;
-- 202610090003_employee_workflows.sql
create table public.employee_import_batches (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 actor_id uuid not null references public.user_profiles(id), row_count integer not null check(row_count between 1 and 1000),
 created_at timestamptz not null default now()
);
alter table public.employee_import_batches enable row level security;
revoke all on public.employee_import_batches from anon,authenticated;
grant select on public.employee_import_batches to authenticated;
create policy import_read on public.employee_import_batches for select to authenticated using(public.has_permission(company_id,'employees.write'));
create function public.import_employees(c uuid,rows_json jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare p jsonb; batch_id uuid;
begin
 perform public.require_permission(c,'employees.write');perform 1 from public.companies where id=c for update;
 if jsonb_typeof(rows_json)<>'array' or jsonb_array_length(rows_json) not between 1 and 1000 then raise exception 'Invalid import size' using errcode='22023'; end if;
 for p in select value from jsonb_array_elements(rows_json) loop perform public.save_employee(c,p); end loop;
 insert into public.employee_import_batches(company_id,actor_id,row_count) values(c,auth.uid(),jsonb_array_length(rows_json)) returning id into batch_id;
 perform public.audit_event(c,'Bulk Employee Import','employee_import',batch_id,jsonb_build_object('rows',jsonb_array_length(rows_json)));
 return batch_id;
end $$;
create function public.bulk_update_employees(c uuid,employee_ids uuid[],field_name text,field_value jsonb) returns void
language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.import_employees(uuid,jsonb),public.bulk_update_employees(uuid,uuid[],text,jsonb) from public,anon,authenticated;
grant execute on function public.import_employees(uuid,jsonb),public.bulk_update_employees(uuid,uuid[],text,jsonb) to authenticated;

-- 202610090004_salary_attendance.sql
create table public.salary_structures (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), name text not null,
 status text not null default 'Draft' check(status in ('Active','Draft','Archived')), created_at timestamptz not null default now(),
 version integer not null default 1, unique(company_id,id),unique(company_id,name)
);
create table public.salary_components (
 code text primary key, name text not null, kind text not null check(kind in ('earning','deduction','employer'))
);
insert into public.salary_components values
 ('basic','Basic','earning'),('hra','HRA','earning'),('special','Special Allowance','earning'),('conveyance','Conveyance','earning'),
 ('other','Other Allowance','earning'),('bonus','Bonus','earning'),('variable','Variable Pay','earning'),
 ('loan','Loan Recovery','deduction'),('advance','Advance Recovery','deduction'),('otherDeduction','Other Deductions','deduction'),('employerOther','Other Employer Contribution','employer');
create table public.salary_structure_components (
 company_id uuid not null, structure_id uuid not null, component_code text not null references public.salary_components(code),
 calculation_type text not null default 'As per record', value_minor bigint check(value_minor between 0 and 9000000000000),
 primary key(company_id,structure_id,component_code),foreign key(company_id,structure_id) references public.salary_structures(company_id,id)
);
create table public.employee_salary_assignments (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid not null,structure_id uuid not null,
 effective_from date not null,remarks text not null default '',created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,employee_id,effective_from),foreign key(company_id,employee_id) references public.employees(company_id,id),
 foreign key(company_id,structure_id) references public.salary_structures(company_id,id)
);
create table public.employee_salary_component_values (
 company_id uuid not null,assignment_id uuid not null,component_code text not null references public.salary_components(code),
 amount_minor bigint not null check(amount_minor between 0 and 9000000000000),primary key(company_id,assignment_id,component_code),
 foreign key(company_id,assignment_id) references public.employee_salary_assignments(company_id,id)
);
create index salary_effective on public.employee_salary_assignments(company_id,employee_id,effective_from desc);
create function public.save_salary_structure(c uuid,p jsonb,e uuid default null,expected_version integer default null) returns uuid
language plpgsql security definer set search_path='' as $$
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
end $$;
create function public.assign_salary(c uuid,e uuid,s uuid,effective date,amounts jsonb,remarks_text text default '')returns uuid
language plpgsql security definer set search_path='' as $$
declare aid uuid; item record;
begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 perform 1 from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found' using errcode='P0002';end if;
 if not exists(select 1 from public.salary_structures where company_id=c and id=s and status='Active')then raise exception 'Active structure required' using errcode='22023';end if;
 if jsonb_typeof(amounts)<>'object' or not(amounts ? 'basic')then raise exception 'Basic component required' using errcode='22023';end if;
 insert into public.employee_salary_assignments(company_id,employee_id,structure_id,effective_from,remarks,created_by)values(c,e,s,effective,remarks_text,auth.uid())returning id into aid;
 for item in select key,value from jsonb_each_text(amounts)loop
  if item.value !~ '^[0-9]+$' then raise exception 'Use integer minor units' using errcode='22023';end if;
  if not exists(select 1 from public.salary_structure_components where company_id=c and structure_id=s and component_code=item.key)then raise exception 'Component not in structure' using errcode='22023';end if;
  insert into public.employee_salary_component_values(company_id,assignment_id,component_code,amount_minor)values(c,aid,item.key,item.value::bigint);
 end loop;
 perform public.audit_event(c,'Salary Revised','employee',e,jsonb_build_object('assignmentId',aid,'effectiveFrom',effective));return aid;
end $$;

create table public.attendance_periods (
 company_id uuid not null references public.companies(id), month date not null check(extract(day from month)=1),
 finalized_at timestamptz,finalized_by uuid references public.user_profiles(id),version integer not null default 1,primary key(company_id,month)
);
create table public.attendance_records (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid not null,date date not null,
 status text not null check(status in('Present','Absent','Paid Leave','Unpaid Leave','Half Day','Weekly Off','Holiday','Work From Home','Missing Punch')),
 shift text not null default '',check_in time,check_out time,work_minutes integer not null default 0 check(work_minutes between 0 and 1440),
 overtime_minutes integer not null default 0 check(overtime_minutes between 0 and 1440),leave_type text not null default '',remarks text not null default '',
 source text not null default 'Manual',modified_by uuid not null references public.user_profiles(id),modified_at timestamptz not null default now(),
 unique(company_id,employee_id,date),foreign key(company_id,employee_id) references public.employees(company_id,id)
);
create index attendance_month on public.attendance_records(company_id,date,employee_id);
create function public.save_attendance(c uuid,rows_json jsonb,reason_text text,allow_update boolean default true)returns integer
language plpgsql security definer set search_path='' as $$
declare p jsonb; d date; e uuid; affected integer:=0; m date;
begin
 perform public.require_permission(c,'attendance.write');
 if length(trim(reason_text))<1 or jsonb_typeof(rows_json)<>'array' or jsonb_array_length(rows_json)not between 1 and 1000 then raise exception 'Reason and rows required' using errcode='22023';end if;
 -- Serialize with finalization. Every write locks the company before period rows.
 perform 1 from public.companies where id=c for update;
 for p in select value from jsonb_array_elements(rows_json)loop
  d:=(p->>'date')::date;e:=(p->>'employeeId')::uuid;m:=date_trunc('month',d)::date;
  insert into public.attendance_periods(company_id,month)values(c,m)on conflict do nothing;
  if exists(select 1 from public.attendance_periods where company_id=c and month=m and finalized_at is not null)then raise exception 'Attendance finalized' using errcode='23514';end if;
  if not exists(select 1 from public.employees where company_id=c and id=e and joining_date<=d and(exit_date is null or exit_date>=d))then raise exception 'Employee/date invalid' using errcode='22023';end if;
  if not allow_update and exists(select 1 from public.attendance_records where company_id=c and employee_id=e and date=d)then raise exception 'Duplicate attendance import' using errcode='23505';end if;
  insert into public.attendance_records(company_id,employee_id,date,status,shift,check_in,check_out,work_minutes,overtime_minutes,leave_type,remarks,source,modified_by)
  values(c,e,d,p->>'status',coalesce(p->>'shift',''),nullif(p->>'checkIn','')::time,nullif(p->>'checkOut','')::time,coalesce((p->>'workMinutes')::integer,0),coalesce((p->>'overtimeMinutes')::integer,0),coalesce(p->>'leaveType',''),coalesce(p->>'remarks',''),'Manual',auth.uid())
  on conflict(company_id,employee_id,date)do update set status=excluded.status,shift=excluded.shift,check_in=excluded.check_in,check_out=excluded.check_out,work_minutes=excluded.work_minutes,overtime_minutes=excluded.overtime_minutes,leave_type=excluded.leave_type,remarks=excluded.remarks,modified_by=auth.uid(),modified_at=now();
  perform public.audit_event(c,'Attendance Modified','employee',e,jsonb_build_object('date',d,'reason',reason_text));affected:=affected+1;
 end loop;return affected;
end $$;
create function public.finalize_attendance(c uuid,m date,reopen boolean default false,reason_text text default '')returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.require_permission(c,case when reopen then 'payroll.unlock' else 'attendance.write'end);
 if extract(day from m)<>1 then raise exception 'First day required' using errcode='22023';end if;
 if reopen and length(trim(reason_text))<1 then raise exception 'Correction reason required' using errcode='22023';end if;
 perform 1 from public.companies where id=c for update;
 insert into public.attendance_periods(company_id,month)values(c,m)on conflict do nothing;
 if not reopen and exists(
  select 1 from public.employees emp cross join generate_series(m,(m+interval '1 month - 1 day')::date,interval '1 day')d
  where emp.company_id=c and emp.joining_date<=d::date and(emp.exit_date is null or emp.exit_date>=d::date)and emp.status not in('Inactive','Salary Hold')
  and not exists(select 1 from public.attendance_records a where a.company_id=c and a.employee_id=emp.id and a.date=d::date and a.status<>'Missing Punch')
 )then raise exception 'Complete every employment day before finalization' using errcode='23514';end if;
 update public.attendance_periods set finalized_at=case when reopen then null else now()end,finalized_by=case when reopen then null else auth.uid()end,version=version+1 where company_id=c and month=m;
 perform public.audit_event(c,case when reopen then 'Attendance Reopened' else 'Attendance Finalized'end,'attendance_period',null,jsonb_build_object('month',m,'reason',reason_text));
end $$;

do $$declare t text;begin
 foreach t in array array['salary_structures','salary_structure_components','employee_salary_assignments','employee_salary_component_values','attendance_periods','attendance_records']loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
alter table public.salary_components enable row level security;
revoke all on public.salary_components from anon,authenticated;grant select on public.salary_components to authenticated;
create policy component_read on public.salary_components for select to authenticated using(true);
create policy structure_read on public.salary_structures for select to authenticated using(public.has_permission(company_id,'salary.read')or public.has_permission(company_id,'salary.write'));
create policy structure_component_read on public.salary_structure_components for select to authenticated using(public.has_permission(company_id,'salary.read')or public.has_permission(company_id,'salary.write'));
create policy assignment_read on public.employee_salary_assignments for select to authenticated using(public.has_permission(company_id,'salary.read'));
create policy salary_value_read on public.employee_salary_component_values for select to authenticated using(public.has_permission(company_id,'salary.read'));
create policy attendance_period_read on public.attendance_periods for select to authenticated using(public.is_member(company_id));
create policy attendance_read on public.attendance_records for select to authenticated using(public.has_permission(company_id,'attendance.read')or(public.is_member(company_id)and exists(select 1 from public.employees e where e.company_id=attendance_records.company_id and e.id=attendance_records.employee_id and e.user_id=auth.uid())));
revoke all on function public.save_salary_structure(uuid,jsonb,uuid,integer),public.assign_salary(uuid,uuid,uuid,date,jsonb,text),public.save_attendance(uuid,jsonb,text,boolean),public.finalize_attendance(uuid,date,boolean,text)from public,anon,authenticated;
grant execute on function public.save_salary_structure(uuid,jsonb,uuid,integer),public.assign_salary(uuid,uuid,uuid,date,jsonb,text),public.save_attendance(uuid,jsonb,text,boolean),public.finalize_attendance(uuid,date,boolean,text)to authenticated;

-- 202610090005_salary_holds.sql
create table public.salary_holds (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid not null,month date not null check(extract(day from month)=1),
 reason text not null check(length(reason)>0),remarks text not null default '',held_by uuid not null references public.user_profiles(id),held_at timestamptz not null default now(),
 released_by uuid references public.user_profiles(id),released_at timestamptz,release_remarks text,foreign key(company_id,employee_id)references public.employees(company_id,id)
);
create unique index one_active_salary_hold on public.salary_holds(company_id,employee_id,month)where released_at is null;
alter table public.salary_holds enable row level security;revoke all on public.salary_holds from anon,authenticated;grant select on public.salary_holds to authenticated;
create policy hold_read on public.salary_holds for select to authenticated using(public.has_permission(company_id,'salary.read'));
create function public.salary_hold(c uuid,e uuid,m date,release_hold boolean,reason_text text,remarks_text text)returns void
language plpgsql security definer set search_path=''as $$
begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;perform 1 from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;
 if release_hold then
  if length(trim(reason_text))<1 then raise exception 'Release reason required'using errcode='22023';end if;
  update public.salary_holds set released_by=auth.uid(),released_at=now(),release_remarks=remarks_text where company_id=c and employee_id=e and month=m and released_at is null;
  if not found then raise exception 'Active hold not found'using errcode='P0002';end if;
 else insert into public.salary_holds(company_id,employee_id,month,reason,remarks,held_by)values(c,e,m,reason_text,remarks_text,auth.uid());end if;
 perform public.audit_event(c,case when release_hold then 'Salary Released'else 'Salary Put on Hold'end,'employee',e,jsonb_build_object('month',m));
end $$;
create function public.import_salary(c uuid,rows_json jsonb)returns integer
language plpgsql security definer set search_path=''as $$declare p jsonb;n integer:=0;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;if jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 1000 then raise exception 'Invalid rows'using errcode='22023';end if;
 for p in select value from jsonb_array_elements(rows_json)loop
  perform public.assign_salary(c,(p->>'employeeId')::uuid,(p->>'structureId')::uuid,(p->>'effectiveFrom')::date,p->'amounts',coalesce(p->>'remarks',''));n:=n+1;
 end loop;return n;
end $$;
revoke all on function public.salary_hold(uuid,uuid,date,boolean,text,text),public.import_salary(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.salary_hold(uuid,uuid,date,boolean,text,text),public.import_salary(uuid,jsonb)to authenticated;

-- 202610090006_employee_kyc.sql
alter table public.employee_statutory_details add column pan_status text not null default 'Not Provided'check(pan_status in('Verified','Pending Verification','Rejected','Not Provided'));
alter table public.employee_statutory_details add column bank_status text not null default 'Not Provided'check(bank_status in('Verified','Pending Verification','Rejected','Not Provided'));
alter table public.employee_statutory_details add column tax_regime text check(tax_regime in('Old Regime','New Regime'));
alter table public.employee_statutory_details add column declaration_status text not null default 'Pending'check(declaration_status in('Pending','Submitted','Verified'));
create function public.save_employee_kyc(c uuid,e uuid,p jsonb)returns void
language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
 perform 1 from public.employees where company_id=c and id=e for update;if not found then raise exception 'Employee not found'using errcode='P0002';end if;
 insert into public.employee_statutory_details(company_id,employee_id)values(c,e)on conflict do nothing;
 if p ? 'pfApplicable'then update public.employee_statutory_details set pf_applicable=(p->>'pfApplicable')::boolean where company_id=c and employee_id=e;end if;
 if p ? 'esiApplicable'then update public.employee_statutory_details set esi_applicable=(p->>'esiApplicable')::boolean where company_id=c and employee_id=e;end if;
 if p ? 'ptApplicable'then update public.employee_statutory_details set pt_applicable=(p->>'ptApplicable')::boolean where company_id=c and employee_id=e;end if;
 if p ? 'tdsApplicable'then update public.employee_statutory_details set tds_applicable=(p->>'tdsApplicable')::boolean where company_id=c and employee_id=e;end if;
 if p ? 'taxRegime'then update public.employee_statutory_details set tax_regime=p->>'taxRegime'where company_id=c and employee_id=e;end if;
 if p ? 'declarationStatus'then update public.employee_statutory_details set declaration_status=p->>'declarationStatus'where company_id=c and employee_id=e;end if;
 if p ? 'panStatus'then
  if p->>'panStatus'='Verified'and not exists(select 1 from public.employee_statutory_details where company_id=c and employee_id=e and pan is not null)then raise exception 'PAN required for manual verification'using errcode='23514';end if;
  update public.employee_statutory_details set pan_status=p->>'panStatus'where company_id=c and employee_id=e;
 end if;
 if p ? 'bankStatus'then
  if p->>'bankStatus'='Verified'and not exists(select 1 from public.employee_bank_details where company_id=c and employee_id=e and account_number<>''and ifsc_code<>'')then raise exception 'Bank details required for manual verification'using errcode='23514';end if;
  update public.employee_statutory_details set bank_status=p->>'bankStatus'where company_id=c and employee_id=e;
 end if;
 perform public.audit_event(c,'KYC Updated','employee',e,jsonb_build_object('verificationSource','manual','fields',(select jsonb_agg(key)from jsonb_object_keys(p)key)));
end $$;
revoke all on function public.save_employee_kyc(uuid,uuid,jsonb)from public,anon,authenticated;grant execute on function public.save_employee_kyc(uuid,uuid,jsonb)to authenticated;

-- 202610090007_leave_workflows.sql
create table public.leave_types (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),name text not null,paid boolean not null,
 working_days smallint[] not null check(cardinality(working_days)between 1 and 7 and working_days<@array[1,2,3,4,5,6,7]::smallint[]),
 unique(company_id,id),unique(company_id,name)
);
create table public.holidays (company_id uuid not null references public.companies(id),date date not null,name text not null,primary key(company_id,date));
create table public.employee_leave_balances (
 company_id uuid not null,employee_id uuid not null,type_id uuid not null,period_start date not null,period_end date not null check(period_end>=period_start),
 allocated_days numeric(7,2)not null check(allocated_days>=0),used_days numeric(7,2)not null default 0 check(used_days>=0 and used_days<=allocated_days),
 primary key(company_id,employee_id,type_id,period_start),foreign key(company_id,employee_id)references public.employees(company_id,id),foreign key(company_id,type_id)references public.leave_types(company_id,id)
);
create table public.leave_requests (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid not null,type_id uuid not null,
 from_date date not null,to_date date not null check(to_date>=from_date),days integer not null check(days>0),reason text not null check(length(reason)>0),
 status text not null default 'Pending'check(status in('Pending','Approved','Rejected')),applied_by uuid not null references public.user_profiles(id),applied_at timestamptz not null default now(),
 unique(company_id,id),foreign key(company_id,employee_id)references public.employees(company_id,id),foreign key(company_id,type_id)references public.leave_types(company_id,id)
);
create table public.leave_approvals (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,request_id uuid not null,actor_id uuid not null references public.user_profiles(id),
 status text not null check(status in('Approved','Rejected')),created_at timestamptz not null default now(),foreign key(company_id,request_id)references public.leave_requests(company_id,id)
);
create function public.save_leave_policy(c uuid,name_text text,is_paid boolean,weekdays smallint[])returns uuid
language plpgsql security definer set search_path=''as $$declare tid uuid;begin
 perform public.require_permission(c,'leave.write');
 insert into public.leave_types(company_id,name,paid,working_days)values(c,name_text,is_paid,weekdays)on conflict(company_id,name)do update set paid=excluded.paid,working_days=excluded.working_days returning id into tid;
 perform public.audit_event(c,'Leave Policy Saved','leave_type',tid);return tid;
end $$;
create function public.allocate_leave(c uuid,e uuid,t uuid,start_date date,end_date date,days_value numeric)returns void
language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'leave.write');perform 1 from public.companies where id=c for update;
 if exists(select 1 from public.employee_leave_balances where company_id=c and employee_id=e and type_id=t and period_start<>start_date and period_start<=end_date and period_end>=start_date)then raise exception 'Overlapping balance period'using errcode='23514';end if;
 insert into public.employee_leave_balances(company_id,employee_id,type_id,period_start,period_end,allocated_days)values(c,e,t,start_date,end_date,days_value)
 on conflict(company_id,employee_id,type_id,period_start)do update set allocated_days=excluded.allocated_days,period_end=excluded.period_end;
 perform public.audit_event(c,'Leave Allocated','employee',e,jsonb_build_object('type',t,'days',days_value));
end $$;
create function public.request_leave(c uuid,e uuid,t uuid,start_date date,end_date date,reason_text text)returns uuid
language plpgsql security definer set search_path=''as $$declare emp public.employees;policy public.leave_types;n integer;rid uuid;begin
 if not public.is_member(c)then raise exception 'Permission denied'using errcode='42501';end if;
 select * into emp from public.employees where company_id=c and id=e;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;
 if emp.user_id is distinct from auth.uid()and not public.has_permission(c,'leave.write')then raise exception 'Own employee only'using errcode='42501';end if;
 if end_date<start_date or end_date-start_date>366 or start_date<emp.joining_date or(emp.exit_date is not null and end_date>emp.exit_date)then raise exception 'Invalid leave dates'using errcode='22023';end if;
 select * into policy from public.leave_types where company_id=c and id=t;if not found then raise exception 'Configure leave policy'using errcode='P0002';end if;
 perform 1 from public.companies where id=c for update;
 if exists(select 1 from public.leave_requests where company_id=c and employee_id=e and status<>'Rejected'and from_date<=end_date and to_date>=start_date)then raise exception 'Overlapping leave'using errcode='23514';end if;
 select count(*)into n from generate_series(start_date,end_date,interval '1 day')d where extract(isodow from d)::smallint=any(policy.working_days)and not exists(select 1 from public.holidays h where h.company_id=c and h.date=d::date);
 insert into public.leave_requests(company_id,employee_id,type_id,from_date,to_date,days,reason,applied_by)values(c,e,t,start_date,end_date,n,reason_text,auth.uid())returning id into rid;
 perform public.audit_event(c,'Leave Requested','leave_request',rid);return rid;
end $$;
create function public.decide_leave(c uuid,r uuid,next_status text)returns void
language plpgsql security definer set search_path=''as $$declare req public.leave_requests;policy public.leave_types;begin
 perform public.require_permission(c,'leave.approve');perform 1 from public.companies where id=c for update;
 select * into req from public.leave_requests where company_id=c and id=r for update;if not found then raise exception 'Request not found'using errcode='P0002';end if;
 if not public.has_permission(c,'leave.write')and not exists(select 1 from public.employees emp join public.employees manager on manager.company_id=emp.company_id and manager.id=emp.manager_id where emp.company_id=c and emp.id=req.employee_id and manager.user_id=auth.uid())then raise exception 'Team access denied'using errcode='42501';end if;
 if req.status<>'Pending'or next_status not in('Approved','Rejected')then raise exception 'Invalid leave transition'using errcode='23514';end if;
 if next_status='Approved'then
  select * into policy from public.leave_types where company_id=c and id=req.type_id;
  if exists(select 1 from public.attendance_periods where company_id=c and finalized_at is not null and month<=req.to_date and(month+interval '1 month - 1 day')::date>=req.from_date)then raise exception 'Attendance period finalized'using errcode='23514';end if;
  if policy.paid then
   update public.employee_leave_balances set used_days=used_days+req.days where company_id=c and employee_id=req.employee_id and type_id=req.type_id and period_start<=req.from_date and period_end>=req.to_date;
   if not found then raise exception 'Allocate leave balance first'using errcode='23514';end if;
  end if;
 end if;
 update public.leave_requests set status=next_status where company_id=c and id=r;
 insert into public.leave_approvals(company_id,request_id,actor_id,status)values(c,r,auth.uid(),next_status);
 perform public.audit_event(c,'Leave '||next_status,'leave_request',r);
end $$;
do $$declare t text;begin foreach t in array array['leave_types','holidays','employee_leave_balances','leave_requests','leave_approvals']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
create policy leave_type_read on public.leave_types for select to authenticated using(public.is_member(company_id));
create policy holiday_read on public.holidays for select to authenticated using(public.is_member(company_id));
create policy leave_balance_read on public.employee_leave_balances for select to authenticated using(public.can_read_employee(company_id,employee_id));
create policy leave_request_read on public.leave_requests for select to authenticated using(public.can_read_employee(company_id,employee_id));
create policy leave_approval_read on public.leave_approvals for select to authenticated using(public.has_permission(company_id,'leave.approve')and exists(select 1 from public.leave_requests r where r.company_id=leave_approvals.company_id and r.id=leave_approvals.request_id));
revoke all on function public.save_leave_policy(uuid,text,boolean,smallint[]),public.allocate_leave(uuid,uuid,uuid,date,date,numeric),public.request_leave(uuid,uuid,uuid,date,date,text),public.decide_leave(uuid,uuid,text)from public,anon,authenticated;
grant execute on function public.save_leave_policy(uuid,text,boolean,smallint[]),public.allocate_leave(uuid,uuid,uuid,date,date,numeric),public.request_leave(uuid,uuid,uuid,date,date,text),public.decide_leave(uuid,uuid,text)to authenticated;

-- 202610090008_attendance_imports.sql
create table public.attendance_import_batches(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),actor_id uuid not null references public.user_profiles(id),
 row_count integer not null check(row_count>0),created_at timestamptz not null default now()
);
alter table public.attendance_import_batches enable row level security;revoke all on public.attendance_import_batches from anon,authenticated;grant select on public.attendance_import_batches to authenticated;
create policy attendance_import_read on public.attendance_import_batches for select to authenticated using(public.has_permission(company_id,'attendance.read'));
create function public.import_attendance(c uuid,rows_json jsonb,reason_text text)returns uuid
language plpgsql security definer set search_path=''as $$declare n integer;bid uuid;begin
 n:=public.save_attendance(c,rows_json,reason_text,false);
 insert into public.attendance_import_batches(company_id,actor_id,row_count)values(c,auth.uid(),n)returning id into bid;
 perform public.audit_event(c,'Attendance Imported','attendance_import',bid,jsonb_build_object('rows',n));return bid;
end $$;
revoke all on function public.import_attendance(uuid,jsonb,text)from public,anon,authenticated;grant execute on function public.import_attendance(uuid,jsonb,text)to authenticated;

-- 202610090009_payroll_engine.sql
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

-- 202610090010_payroll_consistency.sql
alter table public.companies add column payroll_input_version bigint not null default 1;
alter table public.payroll_runs add column input_version bigint;

-- Serialize financial input mutations with calculation, including concurrent RPCs.
create function public.track_payroll_inputs()returns trigger
language plpgsql security definer set search_path=''as $$declare c uuid;begin
 c:=case when tg_op='DELETE'then old.company_id else new.company_id end;
 update public.companies set payroll_input_version=payroll_input_version+1 where id=c;
 if tg_op='DELETE'then return old;end if;return new;
end $$;
do $$declare t text;begin foreach t in array array['employees','employee_bank_details','employee_statutory_details','employee_salary_assignments','employee_salary_component_values','attendance_records','attendance_periods','salary_holds','company_statutory_settings']loop
 execute format('create trigger payroll_input_changed after insert or update or delete on public.%I for each row execute function public.track_payroll_inputs()',t);
end loop;end $$;

create function public.check_payroll_revision()returns trigger
language plpgsql security definer set search_path=''as $$declare current_revision bigint;begin
 select payroll_input_version into current_revision from public.companies where id=new.company_id for update;
 if new.status='Calculated'and old.status in('Draft','Calculated')then
  new.input_version:=current_revision;
 elsif new.status='Approved'and old.status='Calculated'then
  if new.input_version is distinct from current_revision then raise exception 'Payroll inputs changed; recalculate before approval'using errcode='40001';end if;
 end if;
 return new;
end $$;
create trigger payroll_revision_check before update on public.payroll_runs for each row execute function public.check_payroll_revision();

-- A finalized attendance period cannot be reopened behind approved snapshots.
create function public.protect_approved_attendance()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if old.finalized_at is not null and new.finalized_at is null and exists(select 1 from public.payroll_runs where company_id=new.company_id and month=new.month and status in('Approved','Locked'))then
  raise exception 'Unlock payroll with an audited reason before reopening attendance'using errcode='23514';
 end if;return new;
end $$;
create trigger approved_attendance_guard before update on public.attendance_periods for each row execute function public.protect_approved_attendance();
revoke all on function public.track_payroll_inputs(),public.check_payroll_revision(),public.protect_approved_attendance()from public,anon,authenticated;

-- 202610090011_leave_attendance.sql
create function public.apply_approved_leave()returns trigger
language plpgsql security definer set search_path=''as $$declare policy public.leave_types;d date;begin
 if new.status='Approved'and old.status='Pending'then
  select * into policy from public.leave_types where company_id=new.company_id and id=new.type_id;
  for d in select value::date from generate_series(new.from_date,new.to_date,interval '1 day')value where extract(isodow from value)::smallint=any(policy.working_days)and not exists(select 1 from public.holidays where company_id=new.company_id and date=value::date)loop
   insert into public.attendance_periods(company_id,month)values(new.company_id,date_trunc('month',d)::date)on conflict do nothing;
   if exists(select 1 from public.attendance_periods where company_id=new.company_id and month=date_trunc('month',d)::date and finalized_at is not null)then raise exception 'Attendance is finalized'using errcode='23514';end if;
   insert into public.attendance_records(company_id,employee_id,date,status,leave_type,remarks,source,modified_by)
   values(new.company_id,new.employee_id,d,case when policy.paid then 'Paid Leave'else 'Unpaid Leave'end,policy.name,'Approved leave '||new.id,'Manual',auth.uid())
   on conflict(company_id,employee_id,date)do update set status=excluded.status,leave_type=excluded.leave_type,remarks=excluded.remarks,check_in=null,check_out=null,work_minutes=0,overtime_minutes=0,modified_by=auth.uid(),modified_at=now();
  end loop;
 end if;return new;
end $$;
create trigger approved_leave_attendance before update on public.leave_requests for each row execute function public.apply_approved_leave();
-- Preserve the policy that determined request day counts and paid classification.
create function public.protect_used_leave_policy()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if (old.paid is distinct from new.paid or old.working_days is distinct from new.working_days)and exists(select 1 from public.leave_requests where company_id=old.company_id and type_id=old.id)then raise exception 'Create a new policy version for a used leave policy'using errcode='23514';end if;return new;
end $$;
create trigger used_leave_policy_guard before update on public.leave_types for each row execute function public.protect_used_leave_policy();
revoke all on function public.apply_approved_leave(),public.protect_used_leave_policy()from public,anon,authenticated;

-- 202610090012_reviewed_rules.sql
create function public.save_statutory_rule(c uuid,p jsonb)returns uuid
language plpgsql security definer set search_path=''as $$declare rid uuid;start_date date:=(p->>'effectiveFrom')::date;end_date date:=(p->>'effectiveTo')::date;kind text:=p->>'code';state_text text:=coalesce(p->>'state','');components text[];begin
 perform public.require_permission(c,'settings.write');perform 1 from public.companies where id=c for update;
 if end_date is null or end_date<start_date or length(trim(coalesce(p->>'verificationReference','')))=0 then raise exception 'Reviewed date range and reference required'using errcode='22023';end if;
 select array_agg(value)into components from jsonb_array_elements_text(p->'wageComponents');
 if components is null or exists(select 1 from unnest(components)w(component_code) where not exists(select 1 from public.salary_components where salary_components.code=w.component_code and salary_components.kind='earning'))then raise exception 'Invalid wage components'using errcode='22023';end if;
 if exists(select 1 from public.company_statutory_settings where company_id=c and code=kind and state=state_text and effective_from<=end_date and coalesce(effective_to,'infinity'::date)>=start_date)then raise exception 'Overlapping rule period'using errcode='23514';end if;
 insert into public.company_statutory_settings(company_id,code,state,effective_from,effective_to,wage_components,employee_basis_points,employer_basis_points,wage_cap_minor,fixed_minor,verified_by,verification_reference)
 values(c,kind,state_text,start_date,end_date,components,(p->>'employeeBasisPoints')::integer,coalesce((p->>'employerBasisPoints')::integer,0),(p->>'wageCapMinor')::bigint,coalesce((p->>'fixedMinor')::bigint,0),auth.uid(),p->>'verificationReference')returning id into rid;
 perform public.audit_event(c,'Statutory Rule Reviewed','statutory_rule',rid,jsonb_build_object('code',kind,'effectiveFrom',start_date,'effectiveTo',end_date));return rid;
end $$;
revoke all on function public.save_statutory_rule(uuid,jsonb)from public,anon,authenticated;grant execute on function public.save_statutory_rule(uuid,jsonb)to authenticated;

-- Recheck completeness after roster changes, rather than trusting an old finalization.
alter function public.validate_payroll(uuid,date)rename to validate_payroll_internal;
revoke all on function public.validate_payroll_internal(uuid,date)from public,anon,authenticated;
create function public.validate_payroll(c uuid,m date)returns jsonb
language plpgsql security definer set search_path=''as $$declare checks jsonb;issues jsonb;emp record;settings jsonb;begin
 checks:=public.validate_payroll_internal(c,m);issues:=checks->'issues';
 select s.settings into settings from public.company_settings s where company_id=c;
 if settings is not null and ((settings#>>'{payroll,proration}'is not null and settings#>>'{payroll,proration}'<>'calendar')or(settings#>>'{payroll,rounding}'is not null and settings#>>'{payroll,rounding}'<>'half-up'))then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId','','check','Payroll Configuration','severity','Blocking Error','message','This calculation supports calendar-day proration and half-up rounding. Configure these explicitly or use a reviewed calculation implementation.'));end if;
 for emp in select e.id from public.employees e where e.company_id=c and e.status not in('Inactive','Salary Hold')and exists(select 1 from generate_series(greatest(m,e.joining_date),least((m+interval '1 month - 1 day')::date,coalesce(e.exit_date,(m+interval '1 month - 1 day')::date)),interval '1 day')d where not exists(select 1 from public.attendance_records a where a.company_id=c and a.employee_id=e.id and a.date=d::date and a.status<>'Missing Punch'))loop
  issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Attendance Missing','severity','Blocking Error','message','Complete attendance for every employment day, including roster changes after finalization.'));
 end loop;
 return checks||jsonb_build_object('issues',issues,'blockingErrors',jsonb_array_length(issues),'passed',case when jsonb_array_length(issues)=0 then(checks->>'totalChecked')::integer else 0 end);
end $$;
revoke all on function public.validate_payroll(uuid,date)from public,anon,authenticated;grant execute on function public.validate_payroll(uuid,date)to authenticated;
create trigger settings_payroll_input_changed after insert or update or delete on public.company_settings for each row execute function public.track_payroll_inputs();

-- 202610090013_payslips.sql
create table public.payslips(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,run_id uuid not null,employee_id uuid not null,month date not null,
 run_version integer not null,status text not null default 'Draft'check(status in('Draft','Published')),content jsonb not null,
 generated_by uuid not null references public.user_profiles(id),generated_at timestamptz not null default now(),published_by uuid references public.user_profiles(id),published_at timestamptz,
 unique(company_id,run_id,employee_id),foreign key(company_id,run_id)references public.payroll_runs(company_id,id),foreign key(company_id,employee_id)references public.employees(company_id,id)
);
create function public.generate_payslips(c uuid,m date)returns integer
language plpgsql security definer set search_path=''as $$declare run public.payroll_runs;n integer;company_name text;begin
 perform public.require_permission(c,'payroll.run');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and month=m for update;
 if not found or run.status<>'Locked'then raise exception 'Lock payroll before generating payslips'using errcode='23514';end if;
 select name into company_name from public.companies where id=c;
 insert into public.payslips(company_id,run_id,employee_id,month,run_version,content,generated_by)
 select c,run.id,employee_id,m,run.version,snapshot||jsonb_build_object('companyName',company_name,'grossMinor',gross_minor,'deductionMinor',deduction_minor,'netMinor',net_minor,'employerMinor',employer_minor),auth.uid()from public.payroll_run_employees where company_id=c and run_id=run.id
 on conflict(company_id,run_id,employee_id)do update set content=excluded.content,run_version=excluded.run_version,generated_at=now(),generated_by=auth.uid()where payslips.status='Draft';
 get diagnostics n=row_count;perform public.audit_event(c,'Payslips Generated','payroll_run',run.id,jsonb_build_object('count',n));return n;
end $$;
create function public.publish_payslips(c uuid,m date)returns integer
language plpgsql security definer set search_path=''as $$declare run public.payroll_runs;n integer;begin
 perform public.require_permission(c,'payroll.approve');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and month=m for update;
 if not found or run.status<>'Locked'then raise exception 'Lock payroll first'using errcode='23514';end if;
 if exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=run.id and not exists(select 1 from public.payslips p where p.company_id=c and p.run_id=run.id and p.employee_id=e.employee_id and p.run_version=run.version))then raise exception 'Generate current payslips first'using errcode='23514';end if;
 update public.payslips set status='Published',published_by=auth.uid(),published_at=now()where company_id=c and run_id=run.id and status='Draft'and run_version=run.version;
 get diagnostics n=row_count;perform public.audit_event(c,'Payslips Published','payroll_run',run.id,jsonb_build_object('count',n));return n;
end $$;
create function public.protect_published_payroll()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if old.status='Locked'and new.status<>'Locked'and exists(select 1 from public.payslips where company_id=old.company_id and run_id=old.id and status='Published')then raise exception 'Published payroll requires a separate correction workflow'using errcode='23514';end if;return new;
end $$;
create trigger published_payroll_guard before update on public.payroll_runs for each row execute function public.protect_published_payroll();
alter table public.payslips enable row level security;revoke all on public.payslips from anon,authenticated;grant select on public.payslips to authenticated;
create policy payslip_read on public.payslips for select to authenticated using(public.has_permission(company_id,'payslips.read')or(public.is_member(company_id)and status='Published'and exists(select 1 from public.employees where company_id=payslips.company_id and id=payslips.employee_id and user_id=auth.uid())));
revoke all on function public.generate_payslips(uuid,date),public.publish_payslips(uuid,date),public.protect_published_payroll()from public,anon,authenticated;
grant execute on function public.generate_payslips(uuid,date),public.publish_payslips(uuid,date)to authenticated;

-- 202610090014_accounting.sql
create table public.account_groups(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),name text not null,type text not null check(type in('Asset','Liability','Income','Expense','Equity')),parent_id uuid,unique(company_id,id),unique(company_id,name),foreign key(company_id,parent_id)references public.account_groups(company_id,id));
create table public.ledger_accounts(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),group_id uuid not null,name text not null,code text not null,status text not null default 'Active'check(status in('Active','Inactive')),version integer not null default 1,unique(company_id,id),unique(company_id,code),unique(company_id,name),foreign key(company_id,group_id)references public.account_groups(company_id,id));
create table public.financial_years(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),start_date date not null,end_date date not null check(end_date>=start_date),closed_at timestamptz,closed_by uuid references public.user_profiles(id),unique(company_id,start_date));
create table public.journal_entries(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),voucher_number text not null,date date not null,type text not null check(type in('Journal','Payment','Receipt','Contra')),narration text not null,status text not null default 'Draft'check(status in('Draft','Posted')),version integer not null default 1,source_type text not null default 'manual',source_id uuid,reversal_of uuid,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),posted_by uuid references public.user_profiles(id),posted_at timestamptz,unique(company_id,id),unique(company_id,voucher_number),unique(company_id,source_type,source_id),unique(company_id,reversal_of),foreign key(company_id,reversal_of)references public.journal_entries(company_id,id));
create table public.journal_lines(company_id uuid not null,entry_id uuid not null,line_no integer not null,account_id uuid not null,debit_minor bigint not null default 0,credit_minor bigint not null default 0,check(debit_minor between 0 and 9000000000000 and credit_minor between 0 and 9000000000000 and((debit_minor>0 and credit_minor=0)or(credit_minor>0 and debit_minor=0))),primary key(company_id,entry_id,line_no),foreign key(company_id,entry_id)references public.journal_entries(company_id,id),foreign key(company_id,account_id)references public.ledger_accounts(company_id,id));
create function public.save_account(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if p->>'kind'='group'then insert into public.account_groups(company_id,name,type,parent_id)values(c,p->>'name',p->>'type',nullif(p->>'parentId','')::uuid)returning id into rid;
 elsif p->>'kind'='ledger'then insert into public.ledger_accounts(company_id,group_id,name,code)values(c,(p->>'groupId')::uuid,p->>'name',p->>'code')returning id into rid;
 else raise exception 'Invalid account kind'using errcode='22023';end if;
 perform public.audit_event(c,'Account Created','account',rid);return rid;
end $$;
create function public.configure_financial_year(c uuid,start_value date,end_value date)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if end_value<start_value or exists(select 1 from public.financial_years where company_id=c and financial_years.start_date<=end_value and financial_years.end_date>=start_value)then raise exception 'Overlapping or invalid financial year'using errcode='23514';end if;
 insert into public.financial_years(company_id,start_date,end_date)values(c,start_value,end_value)returning id into rid;perform public.audit_event(c,'Financial Year Configured','financial_year',rid);return rid;
end $$;
create function public.create_journal(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;item jsonb;n integer:=0;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if length(trim(coalesce(p->>'narration','')))=0 or jsonb_typeof(p->'lines')<>'array'or jsonb_array_length(p->'lines')not between 2 and 100 then raise exception 'Narration and lines required'using errcode='22023';end if;
 insert into public.journal_entries(company_id,voucher_number,date,type,narration,created_by)values(c,p->>'voucherNumber',(p->>'date')::date,p->>'type',p->>'narration',auth.uid())returning id into rid;
 for item in select value from jsonb_array_elements(p->'lines')loop
  n:=n+1;
  if not exists(select 1 from public.ledger_accounts where company_id=c and id=(item->>'accountId')::uuid and status='Active')then raise exception 'Active company ledger required'using errcode='22023';end if;
  if coalesce(item->>'debitMinor','0')!~'^[0-9]+$'or coalesce(item->>'creditMinor','0')!~'^[0-9]+$'then raise exception 'Integer paise required'using errcode='22023';end if;
  insert into public.journal_lines(company_id,entry_id,line_no,account_id,debit_minor,credit_minor)values(c,rid,n,(item->>'accountId')::uuid,coalesce((item->>'debitMinor')::bigint,0),coalesce((item->>'creditMinor')::bigint,0));
 end loop;
 perform public.audit_event(c,'Journal Created','journal',rid);return rid;
end $$;
create function public.post_journal(c uuid,j uuid,expected_version integer)returns void language plpgsql security definer set search_path=''as $$declare entry public.journal_entries;debits numeric;credits numeric;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into entry from public.journal_entries where company_id=c and id=j for update;
 if not found then raise exception 'Journal not found'using errcode='P0002';end if;if entry.version<>expected_version then raise exception 'Journal changed'using errcode='40001';end if;
 if entry.status<>'Draft'then raise exception 'Already posted'using errcode='23514';end if;
 if not exists(select 1 from public.financial_years where company_id=c and start_date<=entry.date and end_date>=entry.date and closed_at is null)then raise exception 'Configure an open financial year covering this date'using errcode='23514';end if;
 select sum(debit_minor),sum(credit_minor)into debits,credits from public.journal_lines where company_id=c and entry_id=j;
 if debits is null or debits=0 or debits<>credits then raise exception 'Journal must balance before posting'using errcode='23514';end if;
 update public.journal_entries set status='Posted',version=version+1,posted_by=auth.uid(),posted_at=now()where company_id=c and id=j;
 perform public.audit_event(c,'Journal Posted','journal',j,jsonb_build_object('debitMinor',debits,'creditMinor',credits));
end $$;
create function public.reverse_journal(c uuid,j uuid,reversal_date date,reason_text text)returns uuid language plpgsql security definer set search_path=''as $$declare entry public.journal_entries;rid uuid;rows_json jsonb;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into entry from public.journal_entries where company_id=c and id=j for update;
 if not found or entry.status<>'Posted'or length(trim(reason_text))=0 then raise exception 'Posted entry and reason required'using errcode='23514';end if;
 if exists(select 1 from public.journal_entries where company_id=c and reversal_of=j)then raise exception 'Already reversed'using errcode='23514';end if;
 select jsonb_agg(jsonb_build_object('accountId',account_id,'debitMinor',credit_minor,'creditMinor',debit_minor)order by line_no)into rows_json from public.journal_lines where company_id=c and entry_id=j;
 rid:=public.create_journal(c,jsonb_build_object('voucherNumber','REV-'||gen_random_uuid(),'date',reversal_date,'type','Journal','narration',reason_text,'lines',rows_json));
 update public.journal_entries set reversal_of=j where company_id=c and id=rid;perform public.post_journal(c,rid,1);perform public.audit_event(c,'Journal Reversed','journal',j,jsonb_build_object('reversalId',rid,'reason',reason_text));return rid;
end $$;
create function public.account_balances(c uuid)returns table(account_id uuid,debit_minor numeric,credit_minor numeric,balance_minor numeric)language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'accounting.read');return query select a.id,coalesce(sum(l.debit_minor),0),coalesce(sum(l.credit_minor),0),coalesce(sum(l.debit_minor-l.credit_minor),0)from public.ledger_accounts a left join(public.journal_lines l join public.journal_entries j on j.company_id=l.company_id and j.id=l.entry_id and j.status='Posted')on l.company_id=a.company_id and l.account_id=a.id where a.company_id=c group by a.id;
end $$;
do $$declare t text;begin foreach t in array array['account_groups','ledger_accounts','financial_years','journal_entries','journal_lines']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('create policy accounting_read on public.%I for select to authenticated using(public.has_permission(company_id,''accounting.read''))',t);end loop;end $$;
revoke all on function public.save_account(uuid,jsonb),public.configure_financial_year(uuid,date,date),public.create_journal(uuid,jsonb),public.post_journal(uuid,uuid,integer),public.reverse_journal(uuid,uuid,date,text),public.account_balances(uuid)from public,anon,authenticated;
grant execute on function public.save_account(uuid,jsonb),public.configure_financial_year(uuid,date,date),public.create_journal(uuid,jsonb),public.post_journal(uuid,uuid,integer),public.reverse_journal(uuid,uuid,date,text),public.account_balances(uuid)to authenticated;

-- 202610090015_payroll_posting.sql
create table public.payroll_account_mappings(company_id uuid not null references public.companies(id),code text not null check(code in('salaryExpense','employerExpense','netPayable','pf','esi','pt','tds','loan','advance','otherDeduction','employerOther')),account_id uuid not null,primary key(company_id,code),foreign key(company_id,account_id)references public.ledger_accounts(company_id,id));
create function public.save_payroll_accounts(c uuid,mappings jsonb)returns void language plpgsql security definer set search_path=''as $$declare item record;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if jsonb_typeof(mappings)<>'object'then raise exception 'Mappings required'using errcode='22023';end if;
 for item in select key,value from jsonb_each_text(mappings)loop
  if not exists(select 1 from public.ledger_accounts where company_id=c and id=item.value::uuid and status='Active')then raise exception 'Active company ledger required'using errcode='22023';end if;
  insert into public.payroll_account_mappings(company_id,code,account_id)values(c,item.key,item.value::uuid)on conflict(company_id,code)do update set account_id=excluded.account_id;
 end loop;perform public.audit_event(c,'Payroll Accounts Mapped','company',c);
end $$;
create function public.post_payroll_journal(c uuid,m date,expected_version integer)returns uuid language plpgsql security definer set search_path=''as $$declare run public.payroll_runs;lines_json jsonb:='[]';amount record;ledger uuid;rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into run from public.payroll_runs where company_id=c and month=m for update;
 if not found or run.status<>'Locked'then raise exception 'Locked payroll required'using errcode='23514';end if;if run.version<>expected_version then raise exception 'Payroll changed'using errcode='40001';end if;
 if exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id)then raise exception 'Payroll already posted'using errcode='23514';end if;
 for amount in select 'salaryExpense'code,sum(gross_minor)total,true debit from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select 'employerExpense',sum(employer_minor),true from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select 'netPayable',sum(net_minor),false from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select code,sum(amount_minor),false from public.payroll_run_components where company_id=c and run_id=run.id and kind in('deduction','employer')group by code
 loop
  if amount.total>0 then
   select account_id into ledger from public.payroll_account_mappings where company_id=c and code=amount.code;
   if not found then raise exception 'Configure payroll account mappings before posting'using errcode='23514';end if;
   lines_json:=lines_json||jsonb_build_array(jsonb_build_object('accountId',ledger,'debitMinor',case when amount.debit then amount.total else 0 end,'creditMinor',case when amount.debit then 0 else amount.total end));
  end if;
 end loop;
 rid:=public.create_journal(c,jsonb_build_object('voucherNumber','PAY-'||to_char(m,'YYYY-MM'),'date',(m+interval '1 month - 1 day')::date,'type','Journal','narration','Payroll accrual '||to_char(m,'YYYY-MM'),'lines',lines_json));
 update public.journal_entries set source_type='payroll',source_id=run.id where company_id=c and id=rid;perform public.post_journal(c,rid,1);perform public.audit_event(c,'Payroll Journal Posted','payroll_run',run.id,jsonb_build_object('journalId',rid));return rid;
end $$;
create function public.protect_posted_payroll()returns trigger language plpgsql security definer set search_path=''as $$begin
 if old.status='Locked'and new.status<>'Locked'and exists(select 1 from public.journal_entries where company_id=old.company_id and source_type='payroll'and source_id=old.id and status='Posted')then raise exception 'Posted payroll requires accounting reversal and a separate correction workflow'using errcode='23514';end if;return new;
end $$;
create trigger posted_payroll_guard before update on public.payroll_runs for each row execute function public.protect_posted_payroll();
alter table public.payroll_account_mappings enable row level security;revoke all on public.payroll_account_mappings from anon,authenticated;grant select on public.payroll_account_mappings to authenticated;
create policy payroll_mapping_read on public.payroll_account_mappings for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on function public.save_payroll_accounts(uuid,jsonb),public.post_payroll_journal(uuid,date,integer),public.protect_posted_payroll()from public,anon,authenticated;
grant execute on function public.save_payroll_accounts(uuid,jsonb),public.post_payroll_journal(uuid,date,integer)to authenticated;

-- 202610090016_finance_run_visibility.sql
create policy finance_locked_run_read on public.payroll_runs for select to authenticated using(status='Locked'and public.has_permission(company_id,'accounting.read'));

-- 202610090017_employee_exit.sql
create table public.employee_exit_details(company_id uuid not null,employee_id uuid not null,effective_date date not null,last_working_date date not null check(last_working_date<=effective_date),exit_type text not null check(exit_type in('Resignation','Termination','Retirement','Contract Completed','Absconding','Other')),settlement_status text not null check(settlement_status in('Not Started','In Progress','Completed')),reason text not null,remarks text not null default '',primary key(company_id,employee_id),foreign key(company_id,employee_id)references public.employees(company_id,id));
alter function public.change_employee_status(uuid,uuid,text,date,text,text)rename to change_employee_status_internal;
revoke all on function public.change_employee_status_internal(uuid,uuid,text,date,text,text)from public,anon,authenticated;
create function public.change_employment_status(c uuid,e uuid,next_status text,effective date,reason_text text,remarks_text text,expected_version integer,exit_json jsonb default null)returns void
language plpgsql security definer set search_path=''as $$declare old public.employees;last_day date;begin
 perform public.require_permission(c,'employees.write');perform 1 from public.companies where id=c for update;select * into old from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;if expected_version is null or old.version<>expected_version then raise exception 'Employee changed; refresh'using errcode='40001';end if;
 if next_status='Exited'then
  last_day:=(exit_json->>'lastWorkingDate')::date;
  if last_day is null or last_day>effective or last_day<old.joining_date then raise exception 'Valid last working date required'using errcode='22023';end if;
 elsif exit_json is not null then raise exception 'Exit details require exited status'using errcode='22023';end if;
 perform public.change_employee_status_internal(c,e,next_status,effective,reason_text,remarks_text);
 if next_status='Exited'then
  insert into public.employee_exit_details(company_id,employee_id,effective_date,last_working_date,exit_type,settlement_status,reason,remarks)values(c,e,effective,last_day,exit_json->>'exitType',exit_json->>'settlementStatus',reason_text,remarks_text)
  on conflict(company_id,employee_id)do update set effective_date=excluded.effective_date,last_working_date=excluded.last_working_date,exit_type=excluded.exit_type,settlement_status=excluded.settlement_status,reason=excluded.reason,remarks=excluded.remarks;
  update public.employees set exit_date=last_day where company_id=c and id=e;
  perform public.audit_event(c,'Exit Details Saved','employee',e,jsonb_build_object('lastWorkingDate',last_day,'exitType',exit_json->>'exitType','settlementStatus',exit_json->>'settlementStatus'));
 end if;
end $$;
alter table public.employee_exit_details enable row level security;revoke all on public.employee_exit_details from anon,authenticated;grant select on public.employee_exit_details to authenticated;
create policy exit_read on public.employee_exit_details for select to authenticated using(public.can_read_employee(company_id,employee_id));
revoke all on function public.change_employment_status(uuid,uuid,text,date,text,text,integer,jsonb)from public,anon,authenticated;grant execute on function public.change_employment_status(uuid,uuid,text,date,text,text,integer,jsonb)to authenticated;

-- 202610090018_import_and_lock_order.sql
create or replace function public.save_employee(c uuid,p jsonb,employee_uuid uuid default null,expected_version integer default null)
returns uuid language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'employees.write');
 if p ? 'bankDetails'or p ? 'statutory'then perform public.require_permission(c,'employees.sensitive');end if;
 perform 1 from public.companies where id=c for update;
 return public.save_employee_internal(c,p,employee_uuid,expected_version);
end $$;
create table public.salary_import_batches(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),actor_id uuid not null references public.user_profiles(id),row_count integer not null,created_at timestamptz not null default now());
alter function public.import_salary(uuid,jsonb)rename to import_salary_internal;
revoke all on function public.import_salary_internal(uuid,jsonb)from public,anon,authenticated;
create function public.import_salary(c uuid,rows_json jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;n integer;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;n:=public.import_salary_internal(c,rows_json);
 insert into public.salary_import_batches(company_id,actor_id,row_count)values(c,auth.uid(),n)returning id into rid;perform public.audit_event(c,'Salary Import Completed','salary_import',rid,jsonb_build_object('rows',n));return rid;
end $$;
alter table public.salary_import_batches enable row level security;revoke all on public.salary_import_batches from anon,authenticated;grant select on public.salary_import_batches to authenticated;
create policy salary_import_read on public.salary_import_batches for select to authenticated using(public.has_permission(company_id,'salary.read'));
revoke all on function public.import_salary(uuid,jsonb)from public,anon,authenticated;grant execute on function public.import_salary(uuid,jsonb)to authenticated;

commit;
