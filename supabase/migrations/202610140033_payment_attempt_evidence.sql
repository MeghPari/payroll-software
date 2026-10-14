begin;
create table public.salary_payment_attempts(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,batch_id uuid not null,employee_id uuid not null,
 kind text not null check(kind in('Failed','Retry Prepared')),amount_minor bigint not null check(amount_minor>0 and amount_minor<=9000000000000),
 date date not null,reference text not null check(length(trim(reference))between 1 and 160),evidence text not null check(length(trim(evidence))between 1 and 1000),
 retry_of uuid,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,batch_id,employee_id,reference),unique(company_id,retry_of),
 foreign key(company_id,batch_id,employee_id)references public.disbursement_items(company_id,batch_id,employee_id),foreign key(company_id,retry_of)references public.salary_payment_attempts(company_id,id),
 check((kind='Failed'and retry_of is null)or(kind='Retry Prepared'and retry_of is not null))
);
alter table public.salary_payment_attempts enable row level security;
create policy salary_attempts_read on public.salary_payment_attempts for select to authenticated using(public.has_permission(company_id,'disbursements.write'));
revoke all on public.salary_payment_attempts from anon,authenticated;grant select on public.salary_payment_attempts to authenticated;
create function public.record_salary_attempt(c uuid,b uuid,e uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare batch public.disbursement_batches;item public.disbursement_items;run public.payroll_runs;parent public.salary_payment_attempts;paid numeric;rid uuid:=gen_random_uuid();amount bigint;attempt_date date;begin
 perform public.require_permission(c,'disbursements.write');perform 1 from public.companies where id=c for update;
 select * into batch from public.disbursement_batches where company_id=c and id=b and status='Prepared'for update;
 select * into item from public.disbursement_items where company_id=c and batch_id=b and employee_id=e;
 select * into run from public.payroll_runs where company_id=c and id=batch.run_id;
 if batch.id is null or item.employee_id is null or run.status<>'Locked'or run.version<>batch.run_version then raise exception 'Current locked payroll payment instructions required'using errcode='23514';end if;
 amount:=(p->>'amountMinor')::bigint;attempt_date:=(p->>'date')::date;
 if amount is null or amount<=0 or amount>9000000000000 or attempt_date is null or attempt_date<(run.month+interval '1 month - 1 day')::date or attempt_date>(now()at time zone 'Asia/Kolkata')::date or p->>'kind'is null or p->>'kind'not in('Failed','Retry Prepared')or length(trim(coalesce(p->>'reference','')))not between 1 and 160 or length(trim(coalesce(p->>'evidence','')))not between 1 and 1000 then raise exception 'Actual attempt date, amount, reference and evidence required'using errcode='22023';end if;
 select coalesce(sum(t.amount_minor),0)into paid from public.disbursement_payments x join public.bank_transactions t on t.company_id=x.company_id and t.id=x.transaction_id where x.company_id=c and x.batch_id=b and x.employee_id=e and t.status='Confirmed';
 if amount>item.amount_minor-paid then raise exception 'Payment exceeds outstanding salary'using errcode='23514';end if;
 if p->>'kind'='Retry Prepared'then
 select * into parent from public.salary_payment_attempts where company_id=c and id=(p->>'retryOf')::uuid and batch_id=b and employee_id=e and kind='Failed';
 if parent.id is null or attempt_date<parent.date or amount>parent.amount_minor then raise exception 'Matching failed attempt required for retry'using errcode='23514';end if;
 elsif nullif(p->>'retryOf','')is not null then raise exception 'Failed attempts cannot reference a retry'using errcode='22023';end if;
 insert into public.salary_payment_attempts(id,company_id,batch_id,employee_id,kind,amount_minor,date,reference,evidence,retry_of,created_by)values(rid,c,b,e,p->>'kind',amount,attempt_date,trim(p->>'reference'),trim(p->>'evidence'),parent.id,auth.uid());
 perform public.audit_event(c,'Salary Payment Attempt Recorded','salary-attempt',rid,jsonb_build_object('kind',p->>'kind','batchId',b,'employeeId',e));return rid;
end $$;
revoke all on function public.record_salary_attempt(uuid,uuid,uuid,jsonb)from public,anon,authenticated;grant execute on function public.record_salary_attempt(uuid,uuid,uuid,jsonb)to authenticated;
commit;
