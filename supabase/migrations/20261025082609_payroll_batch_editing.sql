-- Apply after upgrade-incremental-payroll.sql. Installation changes no saved salaries or payments.
begin;
create table public.payroll_batch_edit_history(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),run_id uuid not null,
 actor_id uuid not null references public.user_profiles(id),reason text not null,previous_version integer not null,
 snapshot jsonb not null,created_at timestamptz not null default now()
);
alter table public.payroll_batch_edit_history enable row level security;
revoke all on public.payroll_batch_edit_history from public,anon,authenticated;
grant select on public.payroll_batch_edit_history to authenticated;
create policy payroll_edit_history_read on public.payroll_batch_edit_history for select to authenticated using(public.has_permission(company_id,'payroll.run')and public.has_permission(company_id,'employees.sensitive'));
CREATE OR REPLACE FUNCTION public.transition_payroll_batch(c uuid, selected_run uuid, action_text text, expected_version integer, reason_text text DEFAULT ''::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare run public.payroll_runs;m date;begin
 perform public.require_permission(c,case action_text when 'approve'then 'payroll.approve'when 'lock'then 'payroll.lock'when 'unlock'then 'payroll.unlock'else 'payroll.run'end);
 perform 1 from public.companies where id=c for update;perform public.require_permission(c,case action_text when 'approve'then 'payroll.approve'when 'lock'then 'payroll.lock'when 'unlock'then 'payroll.unlock'else 'payroll.run'end);select * into run from public.payroll_runs where company_id=c and id=selected_run for update;m:=run.month;
 if not found then raise exception 'Calculate payroll first'using errcode='P0002';end if;
 if expected_version is null or run.version<>expected_version then raise exception 'Payroll changed; refresh'using errcode='40001';end if;
 if action_text in('approve','lock')and not exists(select 1 from public.payroll_run_employees where company_id=c and run_id=run.id)then raise exception 'This batch has no calculated employees'using errcode='23514';end if;
 if action_text='approve'and run.status='Calculated'then
  if(public.validate_payroll(c,m)->>'blockingErrors')::integer>0 then raise exception 'Validation failed'using errcode='23514';end if;
  update public.payroll_runs set status='Approved',approved_by=auth.uid(),approved_at=now(),version=version+1 where company_id=c and id=run.id;
  insert into public.payroll_approvals(company_id,run_id,actor_id,version)values(c,run.id,auth.uid(),run.version);
 elsif action_text='lock'and run.status='Approved'then update public.payroll_runs set status='Locked',locked_by=auth.uid(),locked_at=now(),version=version+1 where company_id=c and id=run.id;
 elsif action_text='unlock'and run.status in('Approved','Locked')and length(trim(reason_text))>0 then update public.payroll_runs set status='Calculated',approved_by=null,approved_at=null,locked_by=null,locked_at=null,version=version+1 where company_id=c and id=run.id;
 else raise exception 'Invalid payroll transition or missing correction reason'using errcode='23514';end if;
 insert into public.payroll_lock_history(company_id,run_id,actor_id,action,reason)values(c,run.id,auth.uid(),action_text,reason_text);
 perform public.audit_event(c,'Payroll '||action_text,'payroll_run',run.id,jsonb_build_object('reason',reason_text));
end $function$
;
revoke all on function public.transition_payroll_batch(uuid,uuid,text,integer,text)from public,anon,authenticated;
grant execute on function public.transition_payroll_batch(uuid,uuid,text,integer,text)to authenticated;
create or replace function public.transition_payroll(c uuid,m date,action_text text,expected_version integer,reason_text text default '')returns void language plpgsql security definer set search_path=''as $$declare r uuid;begin
 perform public.require_permission(c,case action_text when 'approve'then 'payroll.approve'when 'lock'then 'payroll.lock'when 'unlock'then 'payroll.unlock'else 'payroll.run'end);
 perform 1 from public.companies where id=c for update;
 select id into r from public.payroll_runs where company_id=c and month=m order by batch_number desc limit 1;
 if r is null then raise exception 'Calculate payroll first'using errcode='P0002';end if;
 perform public.transition_payroll_batch(c,r,action_text,expected_version,reason_text);end $$;
create function public.reopen_payroll_batch(c uuid,selected_run uuid,expected_version integer,reason_text text)returns integer language plpgsql security definer set search_path=''as $$
declare r public.payroll_runs;n integer;backup jsonb;begin
 perform public.require_permission(c,'payroll.unlock');perform 1 from public.companies where id=c for update;perform public.require_permission(c,'payroll.unlock');
 if length(trim(coalesce(reason_text,'')))not between 3 and 1000 then raise exception 'Enter an edit reason of 3 to 1000 characters'using errcode='22023';end if;
 select * into r from public.payroll_runs where company_id=c and id=selected_run for update;
 if r.id is null then raise exception 'Payroll batch not found'using errcode='P0002';end if;
 if expected_version is null or r.version<>expected_version then raise exception 'Payroll changed; refresh'using errcode='40001';end if;
 if exists(select 1 from public.payroll_runs where company_id=c and month=r.month and batch_number>r.batch_number)then raise exception 'Only the current batch can be reopened here. Use the correction workflow for an earlier batch.'using errcode='P0053';end if;
 if r.status not in('Calculated','Approved','Locked')then raise exception 'This batch is already open for calculation'using errcode='23514';end if;
 if exists(select 1 from public.payslips where company_id=c and run_id=r.id and status='Published')
 or exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=r.id)
 or exists(select 1 from public.disbursement_batches where company_id=c and run_id=r.id and status='Prepared')
 or exists(select 1 from public.disbursement_payments p join public.disbursement_batches b on b.company_id=p.company_id and b.id=p.batch_id where b.company_id=c and b.run_id=r.id)
 or exists(select 1 from public.payroll_adjustments where company_id=c and source_run_id=r.id)then
 raise exception 'This batch has published, accounting, payment or linked correction history. Use the payroll correction workflow; sample data can be cleared through the audited month reset.'using errcode='P0053';end if;
 select count(*)into n from public.payroll_run_employees where company_id=c and run_id=r.id;
 if n=0 then raise exception 'This batch has no calculated employees'using errcode='23514';end if;
 backup:=jsonb_build_object('run',to_jsonb(r),'employees',(select jsonb_agg(to_jsonb(e)order by employee_id)from public.payroll_run_employees e where company_id=c and run_id=r.id),'components',(select coalesce(jsonb_agg(to_jsonb(e)order by employee_id,code,kind),'[]')from public.payroll_run_components e where company_id=c and run_id=r.id),'payslips',(select coalesce(jsonb_agg(to_jsonb(e)order by id),'[]')from public.payslips e where company_id=c and run_id=r.id));
 insert into public.payroll_batch_edit_history(company_id,run_id,actor_id,reason,previous_version,snapshot)values(c,r.id,auth.uid(),trim(reason_text),r.version,backup);
 delete from public.payslips where company_id=c and run_id=r.id and status='Draft';
 delete from public.payroll_run_components where company_id=c and run_id=r.id;
 delete from public.payroll_run_employees where company_id=c and run_id=r.id;
 update public.payroll_runs set status='Draft',version=version+1,calculated_at=null,calculated_by=null,approved_at=null,approved_by=null,locked_at=null,locked_by=null,input_version=null where company_id=c and id=r.id;
 perform public.audit_event(c,'Payroll Batch Reopened For Editing','payroll_run',r.id,jsonb_build_object('month',r.month,'batchNumber',r.batch_number,'employeeCount',n,'reason',trim(reason_text)));return n;
end $$;
revoke all on function public.reopen_payroll_batch(uuid,uuid,integer,text)from public,anon,authenticated;
grant execute on function public.reopen_payroll_batch(uuid,uuid,integer,text)to authenticated;
create function public.attendance_import_scope(c uuid,m date)returns jsonb language plpgsql stable security definer set search_path=''as $$begin
 perform public.require_permission(c,'attendance.write');return jsonb_build_object('finalized_at',(select finalized_at from public.attendance_periods where company_id=c and month=m),'hasPayroll',exists(select 1 from public.payroll_runs where company_id=c and month=m),'protectedEmployees',(select coalesce(jsonb_agg(employee_id),'[]')from public.payroll_run_employees where company_id=c and payroll_month=m));end $$;
revoke all on function public.attendance_import_scope(uuid,date)from public,anon,authenticated;grant execute on function public.attendance_import_scope(uuid,date)to authenticated;
notify pgrst,'reload schema';
commit;
