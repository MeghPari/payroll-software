begin;
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
commit;
