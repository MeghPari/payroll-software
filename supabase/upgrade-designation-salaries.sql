-- Apply ONCE after migration 045. Seven editable sample designation salaries and P/A attendance support.
begin;
-- Apply after 045. Sample designation rates are editable, not actual pay advice.
create table public.designation_salary_presets(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 designation_name text not null check(length(trim(designation_name))between 1 and 100),
 designation_key text generated always as(lower(trim(designation_name)))stored,
 structure_id uuid not null,amounts jsonb not null,active boolean not null default true,
 version integer not null default 1,updated_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,designation_key),
 foreign key(company_id,structure_id)references public.salary_structures(company_id,id)
);
alter table public.designation_salary_presets enable row level security;
revoke all on public.designation_salary_presets from anon,authenticated;
grant select on public.designation_salary_presets to authenticated;
create policy designation_salary_read on public.designation_salary_presets for select to authenticated using(public.has_permission(company_id,'salary.read'));
alter table public.employees add column salary_mode text not null default 'designation' check(salary_mode in('designation','custom'));
update public.employees e set salary_mode='custom'where exists(select 1 from public.employee_salary_assignments a where a.company_id=e.company_id and a.employee_id=e.id);
alter table public.employee_salary_assignments add column designation_preset_id uuid,add column designation_preset_version integer;
alter table public.employee_salary_assignments add foreign key(company_id,designation_preset_id)references public.designation_salary_presets(company_id,id);

create function public.seed_designation_presets_internal(c uuid)returns void language plpgsql security definer set search_path=''as $$
declare title text;gross bigint;sid uuid;ordinal integer:=0;begin
 if exists(select 1 from public.designation_salary_presets where company_id=c)then return;end if;
 foreach title in array array['Associate','Executive','Senior Executive','Supervisor','Team Lead','Manager','Senior Manager']loop
 ordinal:=ordinal+1;gross:=(array[2800000,4200000,5600000,6500000,7800000,9500000,12000000]::bigint[])[ordinal];
 insert into public.salary_structures(company_id,name,status)values(c,'Designation - '||title,'Active')on conflict(company_id,name)do nothing;
 select id into sid from public.salary_structures where company_id=c and name='Designation - '||title;
 insert into public.salary_structure_components(company_id,structure_id,component_code,calculation_type)select c,sid,code,'As per record'from unnest(array['basic','da','hra','other'])code on conflict do nothing;
 insert into public.designation_salary_presets(company_id,designation_name,structure_id,amounts)values(c,title,sid,jsonb_build_object('basic',gross/2,'da',gross/10,'hra',gross/5,'other',gross/5));
 end loop;
end $$;
revoke all on function public.seed_designation_presets_internal(uuid)from public,anon,authenticated;
do $$declare c uuid;begin for c in select id from public.companies loop perform public.seed_designation_presets_internal(c);end loop;end $$;

-- Reuse the existing assignment constraints, audit and protected-payroll guards.
-- This private copy accepts only amounts supplied by the vetted preset helper.
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.assign_salary(uuid,uuid,uuid,date,jsonb,text)'::regprocedure);
 if strpos(definition,'FUNCTION public.assign_salary(')=0 or strpos(definition,'perform public.require_permission(c,''salary.write'');')=0 then raise exception 'Unexpected salary assignment permission definition';end if;
 definition:=replace(definition,'FUNCTION public.assign_salary(','FUNCTION public.assign_designation_salary_private(');
 definition:=replace(definition,'perform public.require_permission(c,''salary.write'');','');execute definition;
end $$;
revoke all on function public.assign_designation_salary_private(uuid,uuid,uuid,date,jsonb,text)from public,anon,authenticated;

create function public.apply_designation_salary_internal(c uuid,e uuid,force_reviewed boolean default false,effective date default null)returns uuid
language plpgsql security definer set search_path=''as $$
declare emp public.employees;rate public.designation_salary_presets;previous public.employee_salary_assignments;aid uuid;title text;d date;today date;begin
 perform 1 from public.companies where id=c for update;
 if not(public.has_permission(c,'employees.write')or public.has_permission(c,'salary.write'))then raise exception 'Permission denied'using errcode='42501';end if;
 if force_reviewed then perform public.require_permission(c,'salary.write');end if;
 select * into emp from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;
 if not force_reviewed and emp.salary_mode='custom'then return null;end if;
 perform public.seed_designation_presets_internal(c);
 select name into title from public.designations where company_id=c and id=emp.designation_id;
 if lower(trim(coalesce(title,'')))in('','other','custom')then return null;end if;
 select * into rate from public.designation_salary_presets where company_id=c and designation_key=lower(trim(title))and active;
 if not found then return null;end if;
 if not exists(select 1 from public.salary_structures where company_id=c and id=rate.structure_id and status='Active')then return null;end if;
 select * into previous from public.employee_salary_assignments where company_id=c and employee_id=e order by effective_from desc limit 1;
 if not force_reviewed and previous.id is not null then
  if previous.designation_preset_id is null or previous.designation_preset_id=rate.id then return null;end if;
  select(now()at time zone timezone)::date into today from public.companies where id=c;
  effective:=greatest(today,emp.joining_date);
 end if;
 d:=coalesce(effective,emp.joining_date);
 if d<emp.joining_date or(emp.exit_date is not null and d>emp.exit_date)then raise exception 'Salary revision date outside employment'using errcode='22023';end if;
 if exists(select 1 from public.employee_salary_assignments where company_id=c and employee_id=e and effective_from=d)then raise exception 'A salary revision already exists on this date. Choose another reviewed revision date on the employee Salary tab.'using errcode='22023';end if;
 aid:=public.assign_designation_salary_private(c,e,rate.structure_id,d,rate.amounts,'Designation preset: '||rate.designation_name||' (review sample rates)');
 update public.employee_salary_assignments set designation_preset_id=rate.id,designation_preset_version=rate.version where company_id=c and id=aid;
 update public.employees set salary_mode='designation'where company_id=c and id=e;
 perform public.audit_event(c,'Designation Salary Assigned','employee',e,jsonb_build_object('presetId',rate.id,'presetVersion',rate.version,'assignmentId',aid));return aid;
end $$;
revoke all on function public.apply_designation_salary_internal(uuid,uuid,boolean,date)from public,anon,authenticated;

alter function public.save_employee(uuid,jsonb,uuid,integer)rename to save_employee_before_designation;
revoke all on function public.save_employee_before_designation(uuid,jsonb,uuid,integer)from public,anon,authenticated;
create function public.save_employee(c uuid,p jsonb,employee_uuid uuid default null,expected_version integer default null)returns uuid
language plpgsql security definer set search_path=''as $$declare eid uuid;begin
 eid:=public.save_employee_before_designation(c,p,employee_uuid,expected_version);
 if p?'salaryMode'then update public.employees set salary_mode=p->>'salaryMode'where company_id=c and id=eid;end if;
 if lower(trim(coalesce(p->>'designation','')))in('other','custom')then update public.employees set salary_mode='custom'where company_id=c and id=eid;end if;
 perform public.apply_designation_salary_internal(c,eid);return eid;
end $$;
revoke all on function public.save_employee(uuid,jsonb,uuid,integer)from public,anon,authenticated;
grant execute on function public.save_employee(uuid,jsonb,uuid,integer)to authenticated;

-- An explicit salary amount or a custom import always takes precedence.
alter function public.assign_salary(uuid,uuid,uuid,date,jsonb,text)rename to assign_salary_before_designation;
revoke all on function public.assign_salary_before_designation(uuid,uuid,uuid,date,jsonb,text)from public,anon,authenticated;
create function public.assign_salary(c uuid,e uuid,s uuid,effective date,amounts jsonb,remarks_text text default '')returns uuid
language plpgsql security definer set search_path=''as $$declare aid uuid;begin
 aid:=public.assign_salary_before_designation(c,e,s,effective,amounts,remarks_text);
 update public.employees set salary_mode='custom'where company_id=c and id=e;return aid;
end $$;
revoke all on function public.assign_salary(uuid,uuid,uuid,date,jsonb,text)from public,anon,authenticated;
grant execute on function public.assign_salary(uuid,uuid,uuid,date,jsonb,text)to authenticated;
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.import_client_employees(uuid,jsonb)'::regprocedure);
 changed:=replace(definition,'''designation'',p->>''designation'',''workLocation''','''designation'',p->>''designation'',''salaryMode'',case when p->''amounts''<>''null''::jsonb then ''custom''else ''designation''end,''workLocation''');
 if changed=definition then raise exception 'Unexpected client employee import';end if;execute changed;
 definition:=pg_get_functiondef('public.import_attendance_with_employees(uuid,jsonb,jsonb,text)'::regprocedure);
 changed:=replace(definition,'''designation'',''''','''designation'',coalesce(p->>''designation'',''Other'')');
 if changed=definition then raise exception 'Unexpected attendance employee import';end if;execute changed;
end $$;

create function public.list_designation_salary_names(c uuid)returns table(name text)language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'employees.read');return query select designation_name from public.designation_salary_presets where company_id=c and active order by designation_name;
end $$;
create function public.save_designation_salary_preset(c uuid,preset uuid,expected_version integer,title text,amounts_json jsonb,is_active boolean)returns void
language plpgsql security definer set search_path=''as $$declare item record;gross numeric:=0;sid uuid;begin
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
end $$;
create function public.apply_designation_salaries(c uuid)returns integer language plpgsql security definer set search_path=''as $$declare e uuid;n integer:=0;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 for e in select id from public.employees where company_id=c and salary_mode='designation'loop
 if public.apply_designation_salary_internal(c,e)is not null then n:=n+1;end if;end loop;return n;
end $$;
create function public.use_employee_designation_salary(c uuid,e uuid,effective date,expected_version integer)returns uuid language plpgsql security definer set search_path=''as $$declare v integer;aid uuid;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 select version into v from public.employees where company_id=c and id=e for update;
 if expected_version is null or v is null or v<>expected_version then raise exception 'Employee changed; refresh'using errcode='40001';end if;
 if effective is null then raise exception 'Review the salary revision date'using errcode='22023';end if;
 aid:=public.apply_designation_salary_internal(c,e,true,effective);
 if aid is null then raise exception 'No active preset matches this designation. Use Other / Custom salary.'using errcode='22023';end if;return aid;
end $$;
create function public.initialize_designation_presets(c uuid)returns void language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;perform public.seed_designation_presets_internal(c);
end $$;
revoke all on function public.initialize_designation_presets(uuid)from public,anon,authenticated;
grant execute on function public.initialize_designation_presets(uuid)to authenticated;
revoke all on function public.list_designation_salary_names(uuid),public.save_designation_salary_preset(uuid,uuid,integer,text,jsonb,boolean),public.apply_designation_salaries(uuid),public.use_employee_designation_salary(uuid,uuid,date,integer)from public,anon,authenticated;
grant execute on function public.list_designation_salary_names(uuid),public.save_designation_salary_preset(uuid,uuid,integer,text,jsonb,boolean),public.apply_designation_salaries(uuid),public.use_employee_designation_salary(uuid,uuid,date,integer)to authenticated;

alter function public.save_attendance(uuid,jsonb,text,boolean)rename to save_attendance_before_aliases;
revoke all on function public.save_attendance_before_aliases(uuid,jsonb,text,boolean)from public,anon,authenticated;
create function public.save_attendance(c uuid,rows_json jsonb,reason_text text,allow_update boolean default true)returns integer
language plpgsql security definer set search_path=''as $$declare normalized jsonb;begin
 perform public.require_permission(c,'attendance.write');
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 1000 then raise exception 'Invalid attendance rows'using errcode='22023';end if;
 select jsonb_agg(item||jsonb_build_object('status',case upper(trim(item->>'status'))when 'P'then 'Present'when 'A'then 'Absent'when 'WFH'then 'Work From Home'when 'HD'then 'Half Day'when 'L'then 'Paid Leave'when 'H'then 'Holiday'else item->>'status'end)order by ordinal)
 into normalized from jsonb_array_elements(rows_json)with ordinality r(item,ordinal);
 return public.save_attendance_before_aliases(c,normalized,reason_text,allow_update);
end $$;
revoke all on function public.save_attendance(uuid,jsonb,text,boolean)from public,anon,authenticated;
grant execute on function public.save_attendance(uuid,jsonb,text,boolean)to authenticated;

commit;
