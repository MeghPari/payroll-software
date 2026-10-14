-- Apply ONCE after confirmed migrations 001-035.
-- Additive prior-payroll corrections, reviewed cash flow, actual salary-payment dates exact proration rounding and verified session context.
-- Existing published payroll and financial records are retained. No transfer or filing is initiated.
begin;
-- 202610140036_prior_payroll_corrections.sql
alter table public.payroll_adjustments add column source_run_id uuid,add column source_run_version integer,add column source_snapshot jsonb,
 add foreign key(company_id,source_run_id,employee_id)references public.payroll_run_employees(company_id,run_id,employee_id),
 add check((source_run_id is null and source_run_version is null and source_snapshot is null)or(source_run_id is not null and source_run_version is not null and source_snapshot is not null));
create function public.review_prior_payroll_correction(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare run public.payroll_runs;old_row public.payroll_run_employees;e uuid;m date;rid uuid;begin
 perform public.require_permission(c,'salary.write');perform public.require_permission(c,'payroll.run');perform 1 from public.companies where id=c for update;
 e:=(p->>'employeeId')::uuid;m:=(p->>'month')::date;
 select * into run from public.payroll_runs where company_id=c and month=(p->>'sourceMonth')::date for update;
 if run.id is null or run.status<>'Locked'or not(exists(select 1 from public.payslips where company_id=c and run_id=run.id and employee_id=e and run_version=run.version and status='Published')or exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id and status='Posted'))then raise exception 'Published or posted locked source payroll required'using errcode='23514';end if;
 if(p->>'sourceVersion')is null or run.version<>(p->>'sourceVersion')::integer then raise exception 'Source payroll changed; refresh'using errcode='40001';end if;
 if m is null or extract(day from m)<>1 or m<=run.month or p->>'kind'is null or p->>'kind'not in('arrears','otherDeduction')or(p->>'amountMinor')is null or(p->>'amountMinor')::bigint<=0 then raise exception 'Later payroll month and positive reviewed correction required'using errcode='22023';end if;
 select * into old_row from public.payroll_run_employees where company_id=c and run_id=run.id and employee_id=e;
 if not found then raise exception 'Source employee snapshot not found'using errcode='P0002';end if;
 if not exists(select 1 from public.employees where company_id=c and id=e and joining_date<=m+interval '1 month - 1 day'and(exit_date is null or exit_date>=m)and status not in('Inactive','Salary Hold'))then raise exception 'Correction employee must be eligible in the later payroll month'using errcode='23514';end if;
 rid:=public.save_payroll_adjustment(c,jsonb_build_object('employeeId',e,'month',m,'kind',p->>'kind','amountMinor',p->>'amountMinor','reference',p->>'reference','reviewNote',p->>'reviewNote','overtimeMinutes',0));
 update public.payroll_adjustments set source_run_id=run.id,source_run_version=run.version,source_snapshot=jsonb_build_object('month',run.month,'employeeCode',old_row.snapshot->>'employeeCode','employeeName',old_row.snapshot->>'employeeName','grossMinor',old_row.gross_minor,'deductionMinor',old_row.deduction_minor,'netMinor',old_row.net_minor,'earnings',old_row.snapshot->'earnings','deductions',old_row.snapshot->'deductions','employer',old_row.snapshot->'employer','ruleVersions',old_row.snapshot->'ruleVersions')where company_id=c and id=rid;
 perform public.audit_event(c,'Prior Payroll Correction Reviewed','employee',e,jsonb_build_object('sourceRunId',run.id,'sourceVersion',run.version,'adjustmentId',rid,'targetMonth',m,'reference',p->>'reference'));return rid;
end $$;
revoke all on function public.review_prior_payroll_correction(uuid,jsonb)from public,anon,authenticated;grant execute on function public.review_prior_payroll_correction(uuid,jsonb)to authenticated;

-- 202610140037_cash_flow_reviews.sql
create table public.cash_flow_reviews(company_id uuid not null,journal_id uuid not null,version integer not null default 1,net_minor bigint not null,allocations jsonb not null,review_reference text not null check(length(trim(review_reference))between 1 and 1000),reviewed_by uuid not null references public.user_profiles(id),reviewed_at timestamptz not null default now(),primary key(company_id,journal_id),foreign key(company_id,journal_id)references public.journal_entries(company_id,id));
create table public.cash_flow_review_history(company_id uuid not null,journal_id uuid not null,version integer not null,content jsonb not null,primary key(company_id,journal_id,version),foreign key(company_id,journal_id)references public.journal_entries(company_id,id));
alter table public.cash_flow_reviews enable row level security;alter table public.cash_flow_review_history enable row level security;
create policy cash_flow_read on public.cash_flow_reviews for select to authenticated using(public.has_permission(company_id,'accounting.read'));
create policy cash_flow_history_read on public.cash_flow_review_history for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on public.cash_flow_reviews,public.cash_flow_review_history from anon,authenticated;grant select on public.cash_flow_reviews,public.cash_flow_review_history to authenticated;
create function public.review_cash_flow(c uuid,j uuid,expected_version integer,p jsonb)returns void language plpgsql security definer set search_path=''as $$declare entry public.journal_entries;review public.cash_flow_reviews;net bigint;allocated numeric:=0;part jsonb;amount bigint;categories text[]:='{}';begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into entry from public.journal_entries where company_id=c and id=j;
 if entry.id is null or entry.status<>'Posted'then raise exception 'Posted cash movement required'using errcode='23514';end if;
 select * into review from public.cash_flow_reviews where company_id=c and journal_id=j for update;
 if expected_version is null or coalesce(review.version,0)<>expected_version then raise exception 'Cash flow review changed; refresh'using errcode='40001';end if;
 select coalesce(sum(l.debit_minor-l.credit_minor),0)into net from public.journal_lines l join public.bank_accounts b on b.company_id=l.company_id and b.account_id=l.account_id where l.company_id=c and l.entry_id=j;
 if net=0 then raise exception 'A nonzero bank or cash movement is required'using errcode='23514';end if;
 if jsonb_typeof(p->'allocations')is distinct from 'array'or jsonb_array_length(p->'allocations')not between 1 and 3 or length(trim(coalesce(p->>'reviewReference','')))not between 1 and 1000 then raise exception 'Reviewed cash flow allocations required'using errcode='22023';end if;
 for part in select value from jsonb_array_elements(p->'allocations')loop
 amount:=(part->>'amountMinor')::bigint;
 if part->>'category'is null or part->>'category'not in('Operating','Investing','Financing')or(part->>'category')=any(categories)or amount is null or abs(amount::numeric)>9000000000000 then raise exception 'Distinct valid cash flow categories and signed amounts required'using errcode='22023';end if;
 categories:=array_append(categories,part->>'category');allocated:=allocated+amount;end loop;
 if allocated<>net then raise exception 'Cash flow allocations must equal the posted cash movement'using errcode='23514';end if;
 insert into public.cash_flow_reviews(company_id,journal_id,net_minor,allocations,review_reference,reviewed_by)values(c,j,net,p->'allocations',trim(p->>'reviewReference'),auth.uid())
 on conflict(company_id,journal_id)do update set net_minor=excluded.net_minor,allocations=excluded.allocations,review_reference=excluded.review_reference,reviewed_by=excluded.reviewed_by,reviewed_at=now(),version=cash_flow_reviews.version+1;
 insert into public.cash_flow_review_history select company_id,journal_id,version,to_jsonb(r)from public.cash_flow_reviews r where company_id=c and journal_id=j;
 perform public.audit_event(c,'Cash Flow Classification Reviewed','journal',j,jsonb_build_object('netMinor',net,'reference',p->>'reviewReference'));
end $$;
revoke all on function public.review_cash_flow(uuid,uuid,integer,jsonb)from public,anon,authenticated;grant execute on function public.review_cash_flow(uuid,uuid,integer,jsonb)to authenticated;

-- 202610140038_salary_payment_dates.sql
-- Confirmed salary can be paid during its payroll month, including before a
-- weekend/holiday month end. Future dates and dates before the payroll month
-- remain invalid. Locked snapshots, captured bank instructions and limits apply.
do $$declare definition text;changed text;begin
 select pg_get_functiondef('public.record_salary_payment(uuid,uuid,uuid,bigint,date,text,text)'::regprocedure)into definition;
 changed:=replace(definition,'payment_date<(run.month+interval ''1 month - 1 day'')::date','payment_date<run.month');if changed=definition then raise exception 'Salary payment date anchor missing';end if;execute changed;
 select pg_get_functiondef('public.record_salary_attempt(uuid,uuid,uuid,jsonb)'::regprocedure)into definition;
 changed:=replace(definition,'attempt_date<(run.month+interval ''1 month - 1 day'')::date','attempt_date<run.month');if changed=definition then raise exception 'Salary attempt date anchor missing';end if;execute changed;
end $$;

-- 202610140039_exact_proration_rounding.sql
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

-- 202610140040_session_context.sql
-- Request-scoped authorization remains authoritative; combine its reads to
-- avoid multiple provider round trips. Data RPCs/RLS still authorize independently.
create function public.authorize_company_request(c uuid,permission_code text,bucket_name text)returns jsonb language plpgsql security definer set search_path=''as $$declare membership_role text;quota jsonb;begin
 select m.role into membership_role from public.user_company_roles m join public.user_profiles p on p.id=m.user_id where m.company_id=c and m.user_id=auth.uid()and m.active and p.active;
 if not found then raise exception 'Company access denied'using errcode='42501';end if;
 if permission_code is not null and not exists(select 1 from public.role_permissions where role=membership_role and permission=permission_code)then raise exception 'Permission denied'using errcode='42501';end if;
 quota:=public.consume_application_request(c,bucket_name);return quota||jsonb_build_object('role',membership_role);
end $$;
create function public.session_context()returns jsonb language plpgsql stable security definer set search_path=''as $$declare memberships jsonb;permissions jsonb;begin
 if not exists(select 1 from public.user_profiles where id=auth.uid()and active)then raise exception 'Account inactive or not provisioned'using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('company_id',m.company_id,'role',m.role,'companies',jsonb_build_object('id',c.id,'name',c.name))order by c.name,m.company_id),'[]')into memberships from public.user_company_roles m join public.companies c on c.id=m.company_id where m.user_id=auth.uid()and m.active;
 select coalesce(jsonb_agg(jsonb_build_object('role',role,'permission',permission)order by role,permission),'[]')into permissions from public.role_permissions;
 return jsonb_build_object('memberships',memberships,'permissions',permissions);
end $$;
revoke all on function public.authorize_company_request(uuid,text,text),public.session_context()from public,anon,authenticated;
grant execute on function public.authorize_company_request(uuid,text,text),public.session_context()to authenticated;

commit;
