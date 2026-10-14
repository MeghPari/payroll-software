begin;
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
commit;
