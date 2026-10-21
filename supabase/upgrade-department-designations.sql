-- Apply after 047. Editable sample gross amounts; existing salaries are retained.
begin;
alter table public.companies add column designation_catalog_version integer not null default 0;
alter table public.designation_salary_presets add column department text not null default 'General' check(length(trim(department)) between 1 and 100);
alter function public.seed_designation_presets_internal(uuid) rename to seed_legacy_designation_presets_internal;
create function public.seed_designation_presets_internal(c uuid) returns void
language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.seed_designation_presets_internal(uuid),public.seed_legacy_designation_presets_internal(uuid)from public,anon,authenticated;
do $$declare c uuid;begin for c in select id from public.companies loop perform public.seed_designation_presets_internal(c);end loop;end $$;

create function public.list_department_designations(c uuid) returns table(name text,department text)
language plpgsql security definer set search_path='' as $$begin
 perform public.require_permission(c,'employees.read');
 return query select p.designation_name,p.department from public.designation_salary_presets p where p.company_id=c and p.active order by p.department,p.designation_name;
end $$;
revoke all on function public.list_department_designations(uuid)from public,anon,authenticated;
grant execute on function public.list_department_designations(uuid)to authenticated;

-- Validate the department before the existing assignment helper runs. Blank
-- departments are filled from a known role; explicit custom pay is preserved.
alter function public.save_employee(uuid,jsonb,uuid,integer)rename to save_employee_before_departments;
revoke all on function public.save_employee_before_departments(uuid,jsonb,uuid,integer)from public,anon,authenticated;
create function public.save_employee(c uuid,p jsonb,employee_uuid uuid default null,expected_version integer default null)returns uuid
language plpgsql security definer set search_path=''as $$declare dept text;begin
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
end $$;
revoke all on function public.save_employee(uuid,jsonb,uuid,integer)from public,anon,authenticated;
grant execute on function public.save_employee(uuid,jsonb,uuid,integer)to authenticated;
commit;
