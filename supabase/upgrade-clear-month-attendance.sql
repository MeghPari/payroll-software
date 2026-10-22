-- Apply after upgrade-employee-dataset-salaries.sql. Also supports the 049/050 rollback schema.
-- Applying this file does not clear any attendance.
begin;
insert into public.permissions(code)values('attendance.delete')on conflict do nothing;
insert into public.role_permissions(role,permission)values('Super Admin','attendance.delete'),('HR Admin','attendance.delete')on conflict do nothing;

create or replace function public.attendance_month_delete_preview(c uuid,m date)returns jsonb
language plpgsql security definer set search_path=''as $$
declare n integer;revision bigint;blocked text;run public.payroll_runs;begin
 perform public.require_permission(c,'attendance.delete');
 if m is null or extract(day from m)<>1 then raise exception 'First day required'using errcode='22023';end if;
 select payroll_input_version into revision from public.companies where id=c;
 select count(*)into n from public.attendance_records where company_id=c and date>=m and date<(m+interval '1 month')::date;
 select * into run from public.payroll_runs where company_id=c and month=m;
 if run.status in('Approved','Locked')or exists(select 1 from public.payroll_approvals where company_id=c and run_id=run.id)
 or exists(select 1 from public.payslips where company_id=c and run_id=run.id)
 or exists(select 1 from public.payroll_posting_details where company_id=c and run_id=run.id)
 or exists(select 1 from public.disbursement_batches where company_id=c and run_id=run.id)
 or exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id)then
 blocked:='Attendance cannot be deleted for payroll with approval, payslip, accounting or payment history. Use the payroll correction workflow.';
 elsif exists(select 1 from public.attendance_periods where company_id=c and month=m and finalized_at is not null)then
 blocked:='Reopen this month in Monthly review before deleting finalized attendance.';
 end if;
 return jsonb_build_object('month',to_char(m,'YYYY-MM'),'count',n,'revision',revision::text,'blockedReason',blocked,'resetsPayrollPreview',coalesce(run.status='Calculated',false));
end $$;

create or replace function public.delete_month_attendance(c uuid,m date,expected_revision text,expected_count integer,reason_text text)returns integer
language plpgsql security definer set search_path=''as $$
declare preview jsonb;n integer;run public.payroll_runs;begin
 perform public.require_permission(c,'attendance.delete');perform 1 from public.companies where id=c for update;
 perform public.require_permission(c,'attendance.delete');
 reason_text:=regexp_replace(coalesce(reason_text,''),'^[[:space:]]+|[[:space:]]+$','','g');
 if length(trim(coalesce(reason_text,'')))not between 3 and 1000 then raise exception 'A remark of 3 to 1000 characters is required to clear attendance'using errcode='22023';end if;
 preview:=public.attendance_month_delete_preview(c,m);
 if preview->>'blockedReason'is not null then raise exception '%',preview->>'blockedReason'using errcode='P0050';end if;
 if expected_revision is null or expected_count is null or expected_revision<>preview->>'revision'or expected_count<>(preview->>'count')::integer then raise exception 'Attendance or payroll inputs changed. Review the deletion preview again.'using errcode='40001';end if;
 n:=(preview->>'count')::integer;if n=0 then return 0;end if;
 select * into run from public.payroll_runs where company_id=c and month=m for update;
 -- Remove only matching markers for this month. Keep original batch/audit history.
 if to_regclass('public.attendance_master_matches')is not null then
  execute 'delete from public.attendance_master_matches where company_id=$1 and date>=$2 and date<($2+interval ''1 month'')::date'using c,m;
 end if;
 delete from public.attendance_records where company_id=c and date>=m and date<(m+interval '1 month')::date;
 update public.attendance_periods set version=version+1 where company_id=c and month=m;
 if run.id is not null then
  delete from public.payroll_run_components where company_id=c and run_id=run.id;
  delete from public.payroll_run_employees where company_id=c and run_id=run.id;
  update public.payroll_runs set status='Draft',version=version+1,calculated_at=null,calculated_by=null,input_version=null where company_id=c and id=run.id;
 end if;
 perform public.audit_event(c,'Month Attendance Deleted','company',c,jsonb_build_object('month',m,'deletedRecords',n,'reason',trim(reason_text),'payrollPreviewReset',run.id is not null));
 return n;
end $$;
revoke all on function public.attendance_month_delete_preview(uuid,date),public.delete_month_attendance(uuid,date,text,integer,text)from public,anon,authenticated;
grant execute on function public.attendance_month_delete_preview(uuid,date),public.delete_month_attendance(uuid,date,text,integer,text)to authenticated;
notify pgrst,'reload schema';
commit;
