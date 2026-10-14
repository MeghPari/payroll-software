begin;
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
commit;
