-- INITIAL SETUP ONLY: tested foundation for an empty Supabase project.
-- Execute once in Supabase SQL Editor as database operator.
-- No Auth accounts or default passwords are created.

-- 202610080001_foundation.sql
-- Apply only to a new Supabase project. No production data is dropped.
begin;
create extension if not exists pgcrypto;

create table public.companies (
  id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 160),
  timezone text not null default 'Asia/Kolkata' check(timezone = 'Asia/Kolkata'),
  created_at timestamptz not null default now()
);
create table public.user_profiles (
  id uuid primary key references auth.users(id), display_name text not null default '',
  active boolean not null default true, created_at timestamptz not null default now()
);
create table public.roles (name text primary key);
create table public.permissions (code text primary key);
create table public.role_permissions (
  role text references public.roles(name), permission text references public.permissions(code), primary key(role,permission)
);
insert into public.roles values ('Super Admin'),('HR Admin'),('Payroll Admin'),('Finance'),('Manager'),('Employee');
insert into public.permissions values
 ('employees.read'),('employees.write'),('employees.sensitive'),('salary.read'),('salary.write'),
 ('attendance.read'),('attendance.write'),('leave.write'),('leave.approve'),
 ('payroll.run'),('payroll.approve'),('payroll.lock'),('payroll.unlock'),('payslips.read'),
 ('disbursements.write'),('accounting.read'),('accounting.write'),('reports.read'),
 ('users.manage'),('settings.write'),('audit.read');
insert into public.role_permissions select 'Super Admin',code from public.permissions;
insert into public.role_permissions values
 ('HR Admin','employees.read'),('HR Admin','employees.write'),('HR Admin','employees.sensitive'),
 ('HR Admin','attendance.read'),('HR Admin','attendance.write'),('HR Admin','leave.write'),('HR Admin','leave.approve'),
 ('Payroll Admin','employees.read'),('Payroll Admin','salary.read'),('Payroll Admin','salary.write'),
 ('Payroll Admin','attendance.read'),('Payroll Admin','payroll.run'),('Payroll Admin','payroll.approve'),
 ('Payroll Admin','payroll.lock'),('Payroll Admin','payslips.read'),
 ('Finance','accounting.read'),('Finance','accounting.write'),('Finance','disbursements.write'),('Finance','reports.read'),
 ('Manager','leave.approve');
create table public.user_company_roles (
  company_id uuid references public.companies(id), user_id uuid references public.user_profiles(id),
  role text not null references public.roles(name), active boolean not null default true,
  created_at timestamptz not null default now(), primary key(company_id,user_id)
);
create index memberships_user on public.user_company_roles(user_id,company_id) where active;

create function public.is_member(c uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_company_roles m join public.user_profiles p on p.id=m.user_id
    where m.company_id=c and m.user_id=auth.uid() and m.active and p.active)
$$;
create function public.has_permission(c uuid, permission_code text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_company_roles m join public.user_profiles p on p.id=m.user_id
    join public.role_permissions rp on rp.role=m.role
    where m.company_id=c and m.user_id=auth.uid() and m.active and p.active and rp.permission=permission_code)
$$;
create function public.require_permission(c uuid, permission_code text) returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.has_permission(c,permission_code) then raise exception 'Permission denied' using errcode='42501'; end if;
end $$;

create table public.company_settings (
 company_id uuid primary key references public.companies(id),
 settings jsonb not null default '{}' check(jsonb_typeof(settings)='object'), updated_at timestamptz not null default now()
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 actor_id uuid references public.user_profiles(id), action text not null, entity_type text not null,
 entity_id uuid, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create index audit_company_time on public.audit_logs(company_id,created_at desc,id);
create function public.audit_event(c uuid,a text,t text,e uuid,meta jsonb default '{}') returns void
language sql security definer set search_path='' as $$
 insert into public.audit_logs(company_id,actor_id,action,entity_type,entity_id,metadata) values(c,auth.uid(),a,t,e,meta)
$$;
-- Internal audit helper must never be callable by API users.
revoke all on function public.audit_event(uuid,text,text,uuid,jsonb) from public, anon, authenticated;

create table public.departments (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 name text not null check(length(name) between 1 and 100), unique(company_id,id), unique(company_id,name)
);
create table public.designations (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 name text not null check(length(name) between 1 and 100), unique(company_id,id), unique(company_id,name)
);
create table public.employees (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 user_id uuid references public.user_profiles(id), employee_code text not null check(employee_code ~ '^[A-Za-z0-9_-]{1,40}$'),
 first_name text not null check(length(first_name) between 1 and 100), last_name text not null check(length(last_name) between 1 and 100),
 email text not null check(length(email) <= 254 and email like '%@%'), phone text not null default '' check(length(phone)<=30),
 department_id uuid, designation_id uuid, manager_id uuid,
 status text not null default 'Active' check(status in ('Active','Probation','On Notice','On Leave','Salary Hold','Inactive','Exited')),
 joining_date date not null, exit_date date check(exit_date >= joining_date), work_location text not null default '',
 state text not null default '', category text not null default 'Permanent' check(category in ('Permanent','Contract','Consultant','Intern','Temporary','Rent Candidate','Other')),
 employment_type text not null default 'Full-time' check(employment_type in ('Full-time','Part-time','Contractor','Intern')),
 version integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(company_id,id), unique(company_id,employee_code), unique(company_id,user_id),
 foreign key(company_id,department_id) references public.departments(company_id,id),
 foreign key(company_id,designation_id) references public.designations(company_id,id),
 foreign key(company_id,manager_id) references public.employees(company_id,id), check(manager_id is distinct from id)
);
create index employees_company_status on public.employees(company_id,status,id);
create index employees_manager on public.employees(company_id,manager_id);
create table public.employee_private_details (
 company_id uuid not null, employee_id uuid not null,
 personal_email text not null default '', date_of_birth date, gender text check(gender in ('Male','Female','Other')),
 address text not null default '', city text not null default '', pincode text not null default '',
 emergency_contact jsonb not null default '{}', primary key(company_id,employee_id),
 foreign key(company_id,employee_id) references public.employees(company_id,id)
);
create table public.employee_bank_details (
 company_id uuid not null, employee_id uuid not null, account_holder_name text not null default '',
 account_number text not null default '' check(account_number='' or account_number ~ '^[0-9]{6,34}$'),
 ifsc_code text not null default '' check(ifsc_code='' or ifsc_code ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
 bank_name text not null default '', branch text not null default '', primary key(company_id,employee_id),
 foreign key(company_id,employee_id) references public.employees(company_id,id)
);
create table public.employee_statutory_details (
 company_id uuid not null, employee_id uuid not null,
 pan text check(pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'), uan text check(uan ~ '^[0-9]{12}$'),
 esic_number text, pf_applicable boolean, esi_applicable boolean, pt_applicable boolean, tds_applicable boolean,
 primary key(company_id,employee_id), unique(company_id,uan),
 foreign key(company_id,employee_id) references public.employees(company_id,id)
);
-- Aadhaar is intentionally not collected in this foundation; no legal necessity established.
create table public.employee_status_history (
 id uuid primary key default gen_random_uuid(), company_id uuid not null, employee_id uuid not null,
 previous_status text not null, new_status text not null, effective_date date not null,
 reason text not null check(length(reason) between 1 and 1000), remarks text not null default '',
 changed_by uuid not null references public.user_profiles(id), created_at timestamptz not null default now(),
 foreign key(company_id,employee_id) references public.employees(company_id,id)
);
create function public.can_read_employee(c uuid,e uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.has_permission(c,'employees.read') or (public.is_member(c) and exists(
  select 1 from public.employees emp where emp.company_id=c and emp.id=e and
   (emp.user_id=auth.uid() or (emp.manager_id in (select me.id from public.employees me where me.company_id=c and me.user_id=auth.uid())
    and exists(select 1 from public.user_company_roles m where m.company_id=c and m.user_id=auth.uid() and m.role='Manager')))))
$$;

create function public.save_employee(c uuid,p jsonb,employee_uuid uuid default null,expected_version integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid; old public.employees; dep uuid; des uuid;
begin
 perform public.require_permission(c,'employees.write');
 -- Same permission protects nested bank/statutory changes; no direct table write grants.
 if not (p ? 'firstName' and p ? 'lastName' and p ? 'email' and p ? 'joiningDate') then
   raise exception 'Missing employee fields' using errcode='22023'; end if;
 if length(coalesce(p->>'department',''))>0 then
  insert into public.departments(company_id,name) values(c,p->>'department') on conflict(company_id,name) do update set name=excluded.name returning id into dep;
 end if;
 if length(coalesce(p->>'designation',''))>0 then
  insert into public.designations(company_id,name) values(c,p->>'designation') on conflict(company_id,name) do update set name=excluded.name returning id into des;
 end if;
 if employee_uuid is null then
  insert into public.employees(company_id,employee_code,first_name,last_name,email,phone,department_id,designation_id,joining_date,work_location,state,employment_type,category)
  values(c,coalesce(nullif(p->>'employeeCode',''),'EMP-'||upper(substr(gen_random_uuid()::text,1,8))),p->>'firstName',p->>'lastName',lower(p->>'email'),coalesce(p->>'phone',''),dep,des,(p->>'joiningDate')::date,coalesce(p->>'workLocation',''),coalesce(p->>'state',''),coalesce(p->>'employmentType','Full-time'),coalesce(p->>'category','Permanent')) returning id into eid;
 else
  select * into old from public.employees where company_id=c and id=employee_uuid for update;
  if not found then raise exception 'Employee not found' using errcode='P0002'; end if;
  if expected_version is null or old.version<>expected_version then raise exception 'Employee changed; refresh and retry' using errcode='40001'; end if;
  update public.employees set first_name=p->>'firstName',last_name=p->>'lastName',email=lower(p->>'email'),phone=coalesce(p->>'phone',''),
   department_id=dep,designation_id=des,joining_date=(p->>'joiningDate')::date,work_location=coalesce(p->>'workLocation',''),state=coalesce(p->>'state',''),
   employment_type=coalesce(p->>'employmentType','Full-time'),category=coalesce(p->>'category','Permanent'),updated_at=now(),version=version+1
  where company_id=c and id=employee_uuid;
  eid:=employee_uuid;
 end if;
 if p ? 'statutory' then
  insert into public.employee_statutory_details(company_id,employee_id,pan,uan,esic_number)
  values(c,eid,nullif(p#>>'{statutory,pan}',''),nullif(p#>>'{statutory,uan}',''),nullif(p#>>'{statutory,esicNumber}',''))
  on conflict(company_id,employee_id) do update set pan=excluded.pan,uan=excluded.uan,esic_number=excluded.esic_number;
 end if;
 if p ? 'bankDetails' then
  insert into public.employee_bank_details(company_id,employee_id,account_holder_name,account_number,ifsc_code,bank_name,branch)
  values(c,eid,coalesce(p#>>'{bankDetails,accountHolderName}',''),coalesce(p#>>'{bankDetails,accountNumber}',''),coalesce(p#>>'{bankDetails,ifscCode}',''),coalesce(p#>>'{bankDetails,bankName}',''),coalesce(p#>>'{bankDetails,branch}',''))
  on conflict(company_id,employee_id) do update set account_holder_name=excluded.account_holder_name,account_number=excluded.account_number,ifsc_code=excluded.ifsc_code,bank_name=excluded.bank_name,branch=excluded.branch;
 end if;
 perform public.audit_event(c,case when employee_uuid is null then 'Employee Created' else 'Employee Updated' end,'employee',eid,
   jsonb_build_object('version',coalesce(old.version,0)+1));
 return eid;
end $$;

create function public.change_employee_status(c uuid,e uuid,next_status text,effective date,reason_text text,remarks_text text default '')
returns void language plpgsql security definer set search_path='' as $$
declare old public.employees;
begin
 perform public.require_permission(c,'employees.write');
 select * into old from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found' using errcode='P0002'; end if;
 if effective<>current_date then raise exception 'Only changes effective today are supported; scheduled lifecycle changes require a job workflow' using errcode='22023'; end if;
 if old.status=next_status then raise exception 'Status already applied' using errcode='22023'; end if;
 update public.employees set status=next_status,exit_date=case when next_status='Exited' then effective else null end,version=version+1,updated_at=now() where company_id=c and id=e;
 insert into public.employee_status_history(company_id,employee_id,previous_status,new_status,effective_date,reason,remarks,changed_by)
  values(c,e,old.status,next_status,effective,reason_text,remarks_text,auth.uid());
 perform public.audit_event(c,'Employee Status Changed','employee',e,jsonb_build_object('previous',old.status,'next',next_status,'effectiveDate',effective));
end $$;

create function public.bootstrap_company(admin_user uuid,company_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 perform pg_advisory_xact_lock(781432);
 if exists(select 1 from public.companies) then raise exception 'Bootstrap already performed'; end if;
 if not exists(select 1 from auth.users where id=admin_user and email_confirmed_at is not null) then raise exception 'Create and confirm an Auth user first'; end if;
 insert into public.user_profiles(id) values(admin_user) on conflict(id) do nothing;
 insert into public.companies(name) values(company_name) returning id into c;
 insert into public.user_company_roles(company_id,user_id,role) values(c,admin_user,'Super Admin');
 insert into public.company_settings(company_id) values(c);
 insert into public.audit_logs(company_id,actor_id,action,entity_type,entity_id) values(c,admin_user,'Company Bootstrapped','company',c);
 return c;
end $$;
revoke all on function public.bootstrap_company(uuid,text) from public,anon,authenticated;
grant execute on function public.bootstrap_company(uuid,text) to service_role;

create function public.set_company_member(c uuid,target_user uuid,next_role text,is_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.require_permission(c,'users.manage');
 -- Serialize membership changes so simultaneous revocations cannot remove all admins.
 perform 1 from public.companies where id=c for update;
 if target_user=auth.uid() then raise exception 'Self membership changes are not allowed' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=target_user and email_confirmed_at is not null) then raise exception 'Confirmed user not found' using errcode='P0002'; end if;
 insert into public.user_profiles(id) values(target_user) on conflict(id) do nothing;
 insert into public.user_company_roles(company_id,user_id,role,active) values(c,target_user,next_role,is_active)
 on conflict(company_id,user_id) do update set role=excluded.role,active=excluded.active;
 perform public.audit_event(c,'Membership Updated','user',target_user,jsonb_build_object('role',next_role,'active',is_active));
end $$;

-- Defense in depth: no anonymous data, no direct writes, explicit read policies.
do $$ declare t text; begin
 foreach t in array array['companies','user_profiles','roles','permissions','role_permissions','user_company_roles','company_settings','audit_logs','departments','designations','employees','employee_private_details','employee_bank_details','employee_statutory_details','employee_status_history'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy company_read on public.companies for select to authenticated using(public.is_member(id));
create policy profile_read on public.user_profiles for select to authenticated using(id=auth.uid());
create policy role_read on public.roles for select to authenticated using(true);
create policy permission_read on public.permissions for select to authenticated using(true);
create policy role_permission_read on public.role_permissions for select to authenticated using(true);
create policy member_read on public.user_company_roles for select to authenticated using(public.is_member(company_id) and (user_id=auth.uid() or public.has_permission(company_id,'users.manage')));
create policy settings_read on public.company_settings for select to authenticated using(public.has_permission(company_id,'settings.write'));
create policy audit_read on public.audit_logs for select to authenticated using(public.has_permission(company_id,'audit.read'));
create policy department_read on public.departments for select to authenticated using(public.is_member(company_id));
create policy designation_read on public.designations for select to authenticated using(public.is_member(company_id));
create policy employee_read on public.employees for select to authenticated using(public.can_read_employee(company_id,id));
create policy private_read on public.employee_private_details for select to authenticated using(public.has_permission(company_id,'employees.sensitive'));
create policy bank_read on public.employee_bank_details for select to authenticated using(public.has_permission(company_id,'employees.sensitive'));
create policy statutory_read on public.employee_statutory_details for select to authenticated using(public.has_permission(company_id,'employees.sensitive'));
create policy status_read on public.employee_status_history for select to authenticated using(public.can_read_employee(company_id,employee_id));

-- Supabase defaults grant EXECUTE to PUBLIC; close every function explicitly.
revoke all on function public.is_member(uuid),public.has_permission(uuid,text),public.require_permission(uuid,text),public.can_read_employee(uuid,uuid),public.save_employee(uuid,jsonb,uuid,integer),public.change_employee_status(uuid,uuid,text,date,text,text),public.set_company_member(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.is_member(uuid),public.has_permission(uuid,text),public.can_read_employee(uuid,uuid),public.save_employee(uuid,jsonb,uuid,integer),public.change_employee_status(uuid,uuid,text,date,text,text),public.set_company_member(uuid,uuid,text,boolean) to authenticated;
commit;


-- 202610090002_foundation_hardening.sql
begin;
-- Mutations also validate sensitive write permission at the database boundary.
-- Wrapping the original RPC keeps its atomic audit and tenant-qualified FKs.
alter function public.save_employee(uuid,jsonb,uuid,integer) rename to save_employee_internal;
revoke all on function public.save_employee_internal(uuid,jsonb,uuid,integer) from public,anon,authenticated;
create function public.save_employee(c uuid,p jsonb,employee_uuid uuid default null,expected_version integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if p ? 'bankDetails' or p ? 'statutory' then perform public.require_permission(c,'employees.sensitive'); end if;
 return public.save_employee_internal(c,p,employee_uuid,expected_version);
end $$;
revoke all on function public.save_employee(uuid,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.save_employee(uuid,jsonb,uuid,integer) to authenticated;

-- Audit and settings writes happen in the same transaction; API clients cannot write tables.
create function public.save_company_settings(c uuid,p jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.require_permission(c,'settings.write');
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Invalid settings' using errcode='22023'; end if;
 insert into public.company_settings(company_id,settings) values(c,p)
 on conflict(company_id) do update set settings=excluded.settings,updated_at=now();
 perform public.audit_event(c,'Settings Updated','company',c);
end $$;
revoke all on function public.save_company_settings(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_company_settings(uuid,jsonb) to authenticated;

-- Lifecycle dates are evaluated in the company's local timezone, not UTC session date.
create or replace function public.change_employee_status(c uuid,e uuid,next_status text,effective date,reason_text text,remarks_text text default '')
returns void language plpgsql security definer set search_path='' as $$
declare old public.employees; local_today date;
begin
 perform public.require_permission(c,'employees.write');
 select (now() at time zone timezone)::date into local_today from public.companies where id=c;
 select * into old from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found' using errcode='P0002'; end if;
 if effective<>local_today then raise exception 'Only changes effective today are supported' using errcode='22023'; end if;
 if old.status=next_status then raise exception 'Status already applied' using errcode='22023'; end if;
 update public.employees set status=next_status,exit_date=case when next_status='Exited' then effective else null end,version=version+1,updated_at=now() where company_id=c and id=e;
 insert into public.employee_status_history(company_id,employee_id,previous_status,new_status,effective_date,reason,remarks,changed_by)
 values(c,e,old.status,next_status,effective,reason_text,remarks_text,auth.uid());
 perform public.audit_event(c,'Employee Status Changed','employee',e,jsonb_build_object('previous',old.status,'next',next_status,'effectiveDate',effective));
end $$;
commit;
