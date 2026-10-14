begin;
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
