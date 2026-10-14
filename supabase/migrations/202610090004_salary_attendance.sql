begin;
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
commit;
