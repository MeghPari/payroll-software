-- Apply after upgrade-clear-month-attendance.sql. Installs an action; deletes no data on installation.
begin;
insert into public.permissions(code)values('payroll.reset')on conflict do nothing;
insert into public.role_permissions(role,permission)values('Super Admin','payroll.reset')on conflict do nothing;
create table public.payroll_month_reset_archives(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),month date not null,
 actor_id uuid not null references public.user_profiles(id),remark text not null,snapshot jsonb not null,created_at timestamptz not null default now()
);
alter table public.payroll_month_reset_archives enable row level security;
revoke all on public.payroll_month_reset_archives from public,anon,authenticated;
grant select on public.payroll_month_reset_archives to authenticated;
create policy month_reset_archive_read on public.payroll_month_reset_archives for select to authenticated
using(public.has_permission(company_id,'payroll.reset')and public.has_permission(company_id,'employees.sensitive'));

create function public.month_reset_context(c uuid,m date)returns jsonb language plpgsql stable set search_path=''as $$
declare r uuid;b uuid[];p uuid[];j uuid[];begin
 select id into r from public.payroll_runs where company_id=c and month=m;
 select coalesce(array_agg(id order by id),'{}')into b from public.disbursement_batches where company_id=c and run_id=r;
 select coalesce(array_agg(transaction_id order by transaction_id),'{}')into p from public.disbursement_payments where company_id=c and batch_id=any(b);
 with recursive journals(id)as(
  select id from public.journal_entries where company_id=c and(source_type='payroll'and source_id=r or id in(select journal_id from public.payroll_posting_details where company_id=c and run_id=r)or id in(select journal_id from public.bank_transactions where company_id=c and id=any(p)))
  union select e.id from public.journal_entries e join journals parent on e.reversal_of=parent.id where e.company_id=c
 )select coalesce(array_agg(id order by id),'{}')into j from journals;
 select coalesce(array_agg(id order by id),'{}')into p from public.bank_transactions where company_id=c and(id=any(p)or journal_id=any(j));
 return jsonb_build_object('run',r,'batches',b,'payments',p,'journals',j);
end $$;
revoke all on function public.month_reset_context(uuid,date)from public,anon,authenticated;

create or replace function public.attendance_month_delete_preview(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$
declare ctx jsonb;r uuid;n integer;rev bigint;blocked text;finalized boolean;counts jsonb;begin
 perform public.require_permission(c,'attendance.delete');
 if m is null or extract(day from m)<>1 then raise exception 'First day required'using errcode='22023';end if;
 ctx:=public.month_reset_context(c,m);r:=(ctx->>'run')::uuid;
 select payroll_input_version into rev from public.companies where id=c;
 select count(*)into n from public.attendance_records where company_id=c and date>=m and date<m+interval '1 month';
 select exists(select 1 from public.attendance_periods where company_id=c and month=m and finalized_at is not null)into finalized;
 if r is not null and not public.has_permission(c,'payroll.reset')then blocked:='A payroll administrator with month-reset permission must reset this month.';end if;
 if exists(select 1 from public.payroll_adjustments where company_id=c and source_run_id=r and month<>m)then blocked:='Another month contains a correction linked to this payroll. Remove that correction before resetting its source month.';end if;
 if exists(select 1 from public.invoice_payments where company_id=c and transaction_id in(select value::uuid from jsonb_array_elements_text(ctx->'payments')))or exists(select 1 from public.invoices where company_id=c and journal_id in(select value::uuid from jsonb_array_elements_text(ctx->'journals')))or exists(select 1 from public.invoice_notes where company_id=c and journal_id in(select value::uuid from jsonb_array_elements_text(ctx->'journals')))then blocked:='A linked journal is used by an invoice. Resolve that dependency before resetting this month.';end if;
 counts:=jsonb_build_object('salaryRows',(select count(*)from public.payroll_run_employees where company_id=c and run_id=r),'attempts',(select count(*)from public.salary_payment_attempts where company_id=c and batch_id in(select value::uuid from jsonb_array_elements_text(ctx->'batches'))),'payslips',(select count(*)from public.payslips where company_id=c and run_id=r),'payments',jsonb_array_length(ctx->'payments'),'journals',jsonb_array_length(ctx->'journals'),'adjustments',(select count(*)from public.payroll_adjustments where company_id=c and month=m));
 return jsonb_build_object('month',to_char(m,'YYYY-MM'),'count',n,'revision',md5(rev::text||ctx::text||counts::text||coalesce((select to_jsonb(pr)::text from public.payroll_runs pr where pr.company_id=c and pr.id=r),'')),'blockedReason',blocked,'hasPayroll',r is not null,'finalized',finalized,'counts',counts,'hasData',n>0 or r is not null or finalized or(counts->>'adjustments')::int>0 or exists(select 1 from public.salary_holds where company_id=c and month=m),'resetsPayrollPreview',r is not null);
end $$;

create function public.reset_attendance_payroll_month(c uuid,m date,expected_revision text,expected_count integer,remark text,confirm_payroll boolean default false)returns integer
language plpgsql security definer set search_path=''as $$
declare ctx jsonb;preview jsonb;r uuid;b uuid[];p uuid[];j uuid[];slips uuid[];recs uuid[];archive uuid;backup jsonb:='{}';t text;condition text;rows jsonb;n integer;begin
 perform public.require_permission(c,'attendance.delete');perform 1 from public.companies where id=c for update;perform public.require_permission(c,'attendance.delete');
 remark:=regexp_replace(coalesce(remark,''),'^[[:space:]]+|[[:space:]]+$','','g');
 if length(remark)not between 3 and 1000 then raise exception 'A reset remark of 3 to 1000 characters is required'using errcode='22023';end if;
 preview:=public.attendance_month_delete_preview(c,m);
 if preview->>'blockedReason'is not null then raise exception '%',preview->>'blockedReason'using errcode='P0050';end if;
 if (preview->>'hasPayroll')::boolean then perform public.require_permission(c,'payroll.reset');if confirm_payroll is distinct from true then raise exception 'Confirm removal of payroll, payslips and recorded payment entries for this month.'using errcode='P0050';end if;end if;
 if expected_revision is null or expected_count is null or expected_revision<>preview->>'revision'or expected_count<>(preview->>'count')::integer then raise exception 'Month changed; review the reset again'using errcode='40001';end if;
 ctx:=public.month_reset_context(c,m);r:=(ctx->>'run')::uuid;
 select coalesce(array_agg(value::uuid),'{}')into b from jsonb_array_elements_text(ctx->'batches');
 select coalesce(array_agg(value::uuid),'{}')into p from jsonb_array_elements_text(ctx->'payments');
 select coalesce(array_agg(value::uuid),'{}')into j from jsonb_array_elements_text(ctx->'journals');
 select coalesce(array_agg(id order by id),'{}')into slips from public.payslips where company_id=c and run_id=r;
 select coalesce(array_agg(distinct reconciliation_id),'{}')into recs from public.bank_reconciliation_matches where company_id=c and journal_id=any(j);
 -- Archive and delete in FK order; foreign keys and all normal protection triggers stay enabled.
 foreach t in array array['notifications','bank_reconciliation_matches','cash_flow_review_history','cash_flow_reviews','disbursement_payments','salary_payment_attempts','disbursement_items','disbursement_batches','bank_transactions','payroll_posting_details','journal_lines','journal_entries','payslips','payroll_adjustments','salary_holds','payroll_client_costs','payroll_run_components','payroll_run_employees','payroll_approvals','payroll_lock_history','payroll_calculation_methods','payroll_runs','attendance_records','attendance_periods']loop
  condition:=case
   when t='notifications'then 'event_key in(select ''payslip:''||x::text from unnest($7)x)'
   when t in('bank_reconciliation_matches','cash_flow_review_history','cash_flow_reviews')then 'journal_id=any($6)'
   when t in('disbursement_payments','salary_payment_attempts','disbursement_items')then 'batch_id=any($4)'
   when t='disbursement_batches'then 'id=any($4)'
   when t='bank_transactions'then 'id=any($5)'
   when t='journal_lines'then 'entry_id=any($6)'
   when t='journal_entries'then 'id=any($6)'
   when t='payroll_runs'then 'id=$3'
   when t in('payroll_adjustments','salary_holds','payroll_client_costs','attendance_periods')then 'month=$2'
   when t='attendance_records'then 'date>=$2 and date<$2+interval ''1 month'''
   else 'run_id=$3'end;
  execute format('select coalesce(jsonb_agg(to_jsonb(row)),''[]'')from public.%I row where company_id=$1 and (%s)',t,condition)into rows using c,m,r,b,p,j,slips;
  backup:=backup||jsonb_build_object(t,rows);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(rec)),'[]')into rows from public.bank_reconciliations rec where company_id=c and id=any(recs);backup:=backup||jsonb_build_object('bank_reconciliations',rows);
 if to_regclass('public.attendance_master_matches')is not null then
  execute 'select coalesce(jsonb_agg(to_jsonb(row)),''[]'')from public.attendance_master_matches row where company_id=$1 and date>=$2 and date<$2+interval ''1 month'''into rows using c,m;
  backup:=backup||jsonb_build_object('attendance_master_matches',rows);
  execute 'delete from public.attendance_master_matches where company_id=$1 and date>=$2 and date<$2+interval ''1 month'''using c,m;
 end if;
 insert into public.payroll_month_reset_archives(company_id,month,actor_id,remark,snapshot)values(c,m,auth.uid(),remark,backup)returning id into archive;
 foreach t in array array['notifications','bank_reconciliation_matches','cash_flow_review_history','cash_flow_reviews','disbursement_payments','salary_payment_attempts','disbursement_items','disbursement_batches','bank_transactions','payroll_posting_details','journal_lines','journal_entries','payslips','payroll_adjustments','salary_holds','payroll_client_costs','payroll_run_components','payroll_run_employees','payroll_approvals','payroll_lock_history','payroll_calculation_methods','payroll_runs','attendance_records','attendance_periods']loop
  -- The archived row image is an exact, company-scoped deletion set.
  execute format('delete from public.%I row where row.company_id=$1 and to_jsonb(row)in(select value from jsonb_array_elements($2))',t)using c,backup->t;
 end loop;
 update public.bank_reconciliations set status='Open',version=version+1,reviewed_by=null,reviewed_at=null where company_id=c and id=any(recs);
 update public.companies set payroll_input_version=payroll_input_version+1 where id=c;
 n:=(preview->>'count')::integer;
 perform public.audit_event(c,'Attendance and Payroll Month Reset','company',c,jsonb_build_object('month',m,'reason',remark,'archiveId',archive,'attendanceDeleted',n,'removedCounts',preview->'counts'));
 return n;
end $$;
revoke all on function public.reset_attendance_payroll_month(uuid,date,text,integer,text,boolean)from public,anon,authenticated;
grant execute on function public.reset_attendance_payroll_month(uuid,date,text,integer,text,boolean)to authenticated;
-- Older clients cannot bypass the explicit payroll acknowledgement.
create or replace function public.delete_month_attendance(c uuid,m date,expected_revision text,expected_count integer,reason_text text)returns integer
language plpgsql security definer set search_path=''as $$begin return public.reset_attendance_payroll_month(c,m,expected_revision,expected_count,reason_text,false);end $$;
notify pgrst,'reload schema';
commit;
