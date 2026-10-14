-- Apply ONCE after the confirmed migrations 001-031.
-- Additive GST review archives, failed-payment/retry evidence, request limits, year-close guards and working-day proration.
-- Existing company, payroll and payment records are retained. No transfer or filing is initiated.
begin;
-- 202610140032_gst_review_archives.sql
create table public.gst_credit_review_history(company_id uuid not null,invoice_id uuid not null,version integer not null,content jsonb not null,recorded_at timestamptz not null default now(),primary key(company_id,invoice_id,version),foreign key(company_id,invoice_id)references public.invoices(company_id,id));
insert into public.gst_credit_review_history select company_id,invoice_id,version,to_jsonb(r),now()from public.gst_credit_reviews r;
create function public.archive_gst_credit_review()returns trigger language plpgsql security definer set search_path=''as $$begin
 insert into public.gst_credit_review_history(company_id,invoice_id,version,content)values(new.company_id,new.invoice_id,new.version,to_jsonb(new));return new;
end $$;
create trigger gst_credit_history after insert or update on public.gst_credit_reviews for each row execute function public.archive_gst_credit_review();
create table public.gst_book_reviews(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),month date not null check(extract(day from month)=1),review_reference text not null check(length(trim(review_reference))between 1 and 1000),content jsonb not null,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),unique(company_id,review_reference),unique(company_id,id));
alter table public.gst_credit_review_history enable row level security;alter table public.gst_book_reviews enable row level security;
create policy gst_credit_history_read on public.gst_credit_review_history for select to authenticated using(public.has_permission(company_id,'accounting.read'));
create policy gst_book_reviews_read on public.gst_book_reviews for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on public.gst_credit_review_history,public.gst_book_reviews from anon,authenticated;grant select on public.gst_credit_review_history,public.gst_book_reviews to authenticated;
create function public.capture_gst_book_review(c uuid,m date,reference_text text)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid:=gen_random_uuid();rows jsonb;company jsonb;begin
 perform public.require_permission(c,'accounting.write');perform public.require_permission(c,'compliance.write');perform 1 from public.companies where id=c for update;
 if m is null or extract(day from m)<>1 or m>date_trunc('month',now()at time zone 'Asia/Kolkata')::date or reference_text is null or length(trim(reference_text))not between 1 and 1000 then raise exception 'Valid month and reviewed archive reference required'using errcode='22023';end if;
 select jsonb_build_object('name',name,'profile',profile)into company from public.companies where id=c;
 with sources as(
  select i.id,i.invoice_number as number,i.kind,i.journal_id,1 as direction,i.taxable_minor,i.cgst_minor,i.sgst_minor,i.igst_minor,i.party_snapshot,to_jsonb(r)as credit_review,'invoice'::text as source from public.invoices i left join public.gst_credit_reviews r on r.company_id=i.company_id and r.invoice_id=i.id where i.company_id=c and i.journal_id is not null
  union all
  select n.id,n.number,i.kind,n.journal_id,case when n.kind='Credit'then -1 else 1 end,n.taxable_minor,n.cgst_minor,n.sgst_minor,n.igst_minor,i.party_snapshot,null,'note'from public.invoice_notes n join public.invoices i on i.company_id=n.company_id and i.id=n.invoice_id where n.company_id=c
 ),events as(
  select s.*,j.id as event_id,j.date,case when j.reversal_of is null then s.direction else -s.direction end as sign from sources s join public.journal_entries j on j.company_id=c and(j.id=s.journal_id or j.reversal_of=s.journal_id)where j.status='Posted'and j.date>=m and j.date<m+interval '1 month'
 )select coalesce(jsonb_agg(jsonb_build_object('id',event_id,'sourceId',id,'source',source,'number',number,'kind',kind,'date',date,'taxableMinor',sign*taxable_minor,'cgstMinor',sign*cgst_minor,'sgstMinor',sign*sgst_minor,'igstMinor',sign*igst_minor,'party',party_snapshot,'creditReviewAtCapture',credit_review)order by date,event_id),'[]')into rows from events;
 insert into public.gst_book_reviews(id,company_id,month,review_reference,content,created_by)values(rid,c,m,trim(reference_text),jsonb_build_object('company',company,'month',m,'rows',rows,'note','Immutable book review captured from posted journals. Eligibility is the saved review at capture time. This is not a submitted return or government acknowledgement.'),auth.uid());
 perform public.audit_event(c,'GST Book Review Archived','gst-review',rid,jsonb_build_object('month',m,'reference',trim(reference_text)));return rid;
end $$;
revoke all on function public.archive_gst_credit_review(),public.capture_gst_book_review(uuid,date,text)from public,anon,authenticated;grant execute on function public.capture_gst_book_review(uuid,date,text)to authenticated;

-- 202610140033_payment_attempt_evidence.sql
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

-- 202610140034_request_limits_year_guards.sql
create table public.application_request_limits(user_id uuid not null references public.user_profiles(id)on delete cascade,bucket text not null check(bucket in('read','write','download')),window_start bigint not null,used integer not null check(used>0),primary key(user_id,bucket));
alter table public.application_request_limits enable row level security;
revoke all on public.application_request_limits from anon,authenticated;
create function public.consume_application_request(c uuid,bucket_name text)returns jsonb language plpgsql security definer set search_path=''as $$declare epoch bigint;current_window bigint;quota integer;requests integer;begin
 if not public.is_member(c)then raise exception 'Permission denied'using errcode='42501';end if;
 quota:=case bucket_name when 'read'then 240 when 'write'then 60 when 'download'then 30 else null end;
 if quota is null then raise exception 'Invalid request bucket'using errcode='22023';end if;
 epoch:=floor(extract(epoch from clock_timestamp()))::bigint;current_window:=epoch/60;
 insert into public.application_request_limits(user_id,bucket,window_start,used)values(auth.uid(),bucket_name,current_window,1)
 on conflict(user_id,bucket)do update set window_start=excluded.window_start,used=case when application_request_limits.window_start=excluded.window_start then least(application_request_limits.used+1,quota+1)else 1 end returning used into requests;
 return jsonb_build_object('allowed',requests<=quota,'retrySeconds',case when requests<=quota then 0 else 60-epoch%60 end);
end $$;
revoke all on function public.consume_application_request(uuid,text)from public,anon,authenticated;grant execute on function public.consume_application_request(uuid,text)to authenticated;
create or replace function public.change_financial_year(c uuid,y uuid,close_year boolean,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare year public.financial_years;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into year from public.financial_years where company_id=c and id=y for update;
 if not found then raise exception 'Financial year not found'using errcode='P0002';end if;if expected_version is null or year.version<>expected_version then raise exception 'Financial year changed; refresh'using errcode='40001';end if;
 if close_year is null or reason_text is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Reason and status required'using errcode='22023';end if;
 if close_year and year.end_date>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Only completed financial years can close'using errcode='23514';end if;
 if close_year and(exists(select 1 from public.journal_entries where company_id=c and status='Draft'and date between year.start_date and year.end_date)or exists(select 1 from public.invoices where company_id=c and status='Draft'and date between year.start_date and year.end_date))then raise exception 'Resolve draft documents before closing year'using errcode='23514';end if;
 if close_year and exists(select 1 from public.payroll_runs r where r.company_id=c and r.month between date_trunc('month',year.start_date)::date and year.end_date and(r.status<>'Locked'or(exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=r.id and(e.gross_minor>0 or e.employer_minor>0))and not exists(select 1 from public.journal_entries j where j.company_id=c and j.source_type='payroll'and j.source_id=r.id and j.status='Posted'))))then raise exception 'Complete payroll and its accrual before closing year'using errcode='23514';end if;
 update public.financial_years set closed_at=case when close_year then now()else null end,closed_by=case when close_year then auth.uid()else null end,version=version+1 where company_id=c and id=y;
 perform public.audit_event(c,'Financial Year Changed','financial_year',y,jsonb_build_object('closed',close_year,'reason',reason_text));
end $$;
revoke all on function public.change_financial_year(uuid,uuid,boolean,integer,text)from public,anon;grant execute on function public.change_financial_year(uuid,uuid,boolean,integer,text)to authenticated;

-- 202610140035_working_day_proration.sql
create index work_schedule_resolution on public.work_schedules(company_id,employee_id,effective_from)where active;
create function public.payroll_is_working_day(c uuid,e uuid,d date)returns boolean language plpgsql stable security definer set search_path=''as $$declare days integer[];begin
 select working_days into days from public.work_schedules where company_id=c and active and(employee_id=e or employee_id is null)and effective_from<=d and(effective_to is null or effective_to>=d)order by(employee_id is not null)desc,effective_from desc limit 1;
 if not found then return null;end if;
 return extract(dow from d)::integer=any(days)and not exists(select 1 from public.holidays where company_id=c and date=d and active and review_reference is not null);
end $$;
create function public.payroll_paid_weight(c uuid,e uuid,d date,status_text text,mode text)returns numeric language plpgsql stable security definer set search_path=''as $$begin
 if mode='working'and public.payroll_is_working_day(c,e,d)is not true then return 0;end if;
 return case when status_text in('Present','Paid Leave','Work From Home')or(mode='calendar'and status_text in('Weekly Off','Holiday'))then 1 when status_text='Half Day'then 0.5 else 0 end;
end $$;
create trigger schedule_payroll_input_changed after insert or update or delete on public.work_schedules for each row execute function public.track_payroll_inputs();
create trigger holiday_payroll_input_changed after insert or update or delete on public.holidays for each row execute function public.track_payroll_inputs();
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.validate_payroll_before_adjustments(uuid,date)'::regprocedure);
 changed:=replace(definition,'settings#>>''{payroll,proration}''<>''calendar''','settings#>>''{payroll,proration}''not in(''calendar'',''working'')');if changed=definition then raise exception 'Proration validation anchor missing';end if;
 changed:=replace(changed,'calendar-day proration and half-up or down rounding','calendar-day or reviewed working-day proration and half-up or down rounding');execute changed;
 definition:=pg_get_functiondef('public.calculate_payroll(uuid,date)'::regprocedure);
 if position('calendar_days integer;item record;'in definition)=0 or position('v.amount_minor::numeric/calendar_days'in definition)=0 or position('''calendarDays'',calendar_days,''paidDays'',paid_days'in definition)=0 then raise exception 'Working day engine anchors missing';end if;
 changed:=replace(definition,'calendar_days integer;item record;','calendar_days integer;proration_days integer;proration_mode text;item record;');
 changed:=replace(changed,'calendar_days:=finish-m+1;','calendar_days:=finish-m+1;select coalesce(settings#>>''{payroll,proration}'',''calendar'')into proration_mode from public.company_settings where company_id=c;proration_mode:=coalesce(proration_mode,''calendar'');');
 changed:=replace(changed,'amounts:=''{}'';','proration_days:=case when proration_mode=''working''then(select count(*)from generate_series(m,finish,interval ''1 day'')day where public.payroll_is_working_day(c,emp.id,day::date))else calendar_days end;amounts:=''{}'';');
 changed:=replace(changed,'sum(case when status in(''Present'',''Paid Leave'',''Weekly Off'',''Holiday'',''Work From Home'')then 1 when status=''Half Day''then 0.5 else 0 end)','sum(public.payroll_paid_weight(c,emp.id,date,status,proration_mode))');
 changed:=replace(changed,'v.amount_minor::numeric/calendar_days*case when ar.status in(''Present'',''Paid Leave'',''Weekly Off'',''Holiday'',''Work From Home'')then 1 when ar.status=''Half Day''then 0.5 else 0 end','v.amount_minor::numeric/proration_days*public.payroll_paid_weight(c,emp.id,d::date,ar.status,proration_mode)');
 changed:=replace(changed,'v.amount_minor::numeric/calendar_days else','v.amount_minor::numeric/proration_days*case when proration_mode=''working''then case when public.payroll_is_working_day(c,emp.id,d::date)then 1 else 0 end else 1 end else');
 changed:=replace(changed,'''calendarDays'',calendar_days,''paidDays'',paid_days','''calendarDays'',calendar_days,''proration'',proration_mode,''prorationDays'',proration_days,''calendarBasis'',jsonb_build_object(''schedules'',(select coalesce(jsonb_agg(to_jsonb(s)order by s.id),''[]'')from public.work_schedules s where s.company_id=c and s.active and(s.employee_id=emp.id or s.employee_id is null)and s.effective_from<=finish and(s.effective_to is null or s.effective_to>=m)),''holidays'',(select coalesce(jsonb_agg(to_jsonb(h)order by h.date),''[]'')from public.holidays h where h.company_id=c and h.active and h.review_reference is not null and h.date between m and finish)),''paidDays'',paid_days');
 changed:=replace(changed,'''lopDays'',count(*)filter(where status in(''Absent'',''Unpaid Leave''))+count(*)filter(where status=''Half Day'')::numeric/2','''proration'',proration_mode,''prorationDays'',proration_days,''lopDays'',coalesce(sum(case when proration_mode=''working''and public.payroll_is_working_day(c,emp.id,date)is not true then 0 when status in(''Absent'',''Unpaid Leave'')then 1 when status=''Half Day''then 0.5 else 0 end),0)');
 if position('v.amount_minor::numeric/calendar_days'in changed)>0 then raise exception 'Proration engine replacement incomplete';end if;execute changed;
end $$;
alter function public.validate_payroll(uuid,date)rename to validate_payroll_before_working_days;
revoke all on function public.validate_payroll_before_working_days(uuid,date)from public,anon,authenticated;
create function public.validate_payroll(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$declare checks jsonb;issues jsonb;mode text;emp record;finish date:=(m+interval '1 month - 1 day')::date;begin
 checks:=public.validate_payroll_before_working_days(c,m);issues:=checks->'issues';select settings#>>'{payroll,proration}'into mode from public.company_settings where company_id=c;
 if mode='working'then
 for emp in select id,joining_date,exit_date from public.employees where company_id=c and joining_date<=finish and(exit_date is null or exit_date>=m)and status not in('Inactive','Salary Hold')loop
 if exists(select 1 from generate_series(m,finish,interval '1 day')d where public.payroll_is_working_day(c,emp.id,d::date)is null)or not exists(select 1 from generate_series(m,finish,interval '1 day')d where public.payroll_is_working_day(c,emp.id,d::date))then
 issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Working Day Calendar','severity','Blocking Error','message','Configure a reviewed schedule for the entire month, including dates before joining or after exit, with at least one working day.'));
 elsif exists(select 1 from public.attendance_records where company_id=c and employee_id=emp.id and date between greatest(m,emp.joining_date)and least(finish,coalesce(emp.exit_date,finish))and status in('Weekly Off','Holiday')and public.payroll_is_working_day(c,emp.id,date))then
 issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Working Day Attendance','severity','Blocking Error','message','A Weekly Off or Holiday attendance status conflicts with the reviewed working calendar. Correct attendance or its reviewed schedule.'));
 end if;end loop;end if;
 return checks||jsonb_build_object('issues',issues,'blockingErrors',jsonb_array_length(issues),'passed',case when jsonb_array_length(issues)=0 then(checks->>'totalChecked')::integer else 0 end);
end $$;
revoke all on function public.payroll_is_working_day(uuid,uuid,date),public.payroll_paid_weight(uuid,uuid,date,text,text),public.validate_payroll(uuid,date)from public,anon,authenticated;grant execute on function public.validate_payroll(uuid,date)to authenticated;

commit;
