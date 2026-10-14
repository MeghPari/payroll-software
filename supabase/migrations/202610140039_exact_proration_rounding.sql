begin;
create table public.payroll_calculation_methods(company_id uuid not null,run_id uuid not null,run_version integer not null,method text not null,calculated_at timestamptz not null default now(),primary key(company_id,run_id,run_version),foreign key(company_id,run_id)references public.payroll_runs(company_id,id));
alter table public.payroll_calculation_methods enable row level security;
create policy payroll_method_read on public.payroll_calculation_methods for select to authenticated using(public.has_permission(company_id,'payroll.run'));
revoke all on public.payroll_calculation_methods from anon,authenticated;grant select on public.payroll_calculation_methods to authenticated;
do $$declare definition text;start_position integer;end_position integer;replacement text;begin
 select pg_get_functiondef('public.calculate_payroll(uuid,date)'::regprocedure)into definition;
 start_position:=strpos(definition,'   select v.component_code,sc.kind,');end_position:=strpos(definition,'   from generate_series(greatest(m,emp.joining_date)');
 if start_position=0 or end_position<=start_position or strpos(definition,'proration_days')=0 then raise exception 'Exact proration engine anchors missing';end if;
 replacement:=$patch$
   select v.component_code,sc.kind,
    public.payroll_round(c,sum(case when sc.kind='earning'and v.component_code not in('bonus','variable')then v.amount_minor::numeric*public.payroll_paid_weight(c,emp.id,d::date,ar.status,proration_mode)
     else case when d::date=least(finish,coalesce(emp.exit_date,finish))then v.amount_minor::numeric*proration_days else 0 end end)/proration_days)::bigint amount,
    public.payroll_round(c,sum(case when sc.kind='earning'and v.component_code not in('bonus','variable')then v.amount_minor::numeric*case when proration_mode='working'then case when public.payroll_is_working_day(c,emp.id,d::date)then 1 else 0 end else 1 end
     else case when d::date=least(finish,coalesce(emp.exit_date,finish))then v.amount_minor::numeric*proration_days else 0 end end)/proration_days)::bigint full_amount
$patch$;
 definition:=substring(definition from 1 for start_position-1)||replacement||substring(definition from end_position);
 if strpos(definition,'perform public.audit_event(c,''Payroll Calculated''')=0 then raise exception 'Calculation method capture anchor missing';end if;
 definition:=replace(definition,'perform public.audit_event(c,''Payroll Calculated''','insert into public.payroll_calculation_methods(company_id,run_id,run_version,method)select c,run.id,version,''exact-proration-v2''from public.payroll_runs where company_id=c and id=run.id;perform public.audit_event(c,''Payroll Calculated''');execute definition;
end $$;
create function public.protect_payroll_calculation_method()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.status='Approved'and old.status='Calculated'and not exists(select 1 from public.payroll_calculation_methods where company_id=old.company_id and run_id=old.id and run_version=old.version and method='exact-proration-v2')then raise exception 'Payroll calculation method changed; recalculate before approval'using errcode='40001';end if;return new;
end $$;
create trigger payroll_method_guard before update of status on public.payroll_runs for each row execute function public.protect_payroll_calculation_method();
revoke all on function public.protect_payroll_calculation_method()from public,anon,authenticated;
commit;
