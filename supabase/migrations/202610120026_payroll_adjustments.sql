begin;
insert into public.salary_components(code,name,kind)values('overtime','Overtime','earning'),('arrears','Arrears','earning'),('reimbursement','Reimbursement','earning');
create table public.payroll_adjustments(id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid not null,month date not null check(extract(day from month)=1),kind text not null check(kind in('overtime','arrears','reimbursement','bonus','otherDeduction')),amount_minor bigint not null check(amount_minor between 0 and 9000000000000),overtime_minutes integer not null default 0 check(overtime_minutes between 0 and 44640),reference text not null check(length(trim(reference))between 1 and 200),review_note text not null check(length(trim(review_note))between 1 and 2000),status text not null default 'Reviewed'check(status in('Reviewed','Cancelled')),version integer not null default 1,reviewed_by uuid not null references public.user_profiles(id),reviewed_at timestamptz not null default now(),unique(company_id,id),unique(company_id,employee_id,kind,reference),foreign key(company_id,employee_id)references public.employees(company_id,id));
create function public.save_payroll_adjustment(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare a uuid;e uuid;m date;v integer;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;a:=nullif(p->>'id','')::uuid;
 if a is not null then select employee_id,month,version into e,m,v from public.payroll_adjustments where company_id=c and id=a for update;if not found then raise exception 'Adjustment not found'using errcode='P0002';end if;
 if(p->>'expectedVersion')is null or v<>(p->>'expectedVersion')::integer then raise exception 'Adjustment changed; refresh'using errcode='40001';end if;
 else e:=(p->>'employeeId')::uuid;m:=(p->>'month')::date;end if;
 if exists(select 1 from public.payroll_runs where company_id=c and month=m and status in('Approved','Locked'))then raise exception 'Approved payroll adjustments are protected'using errcode='23514';end if;
 if not exists(select 1 from public.employees where company_id=c and id=e and joining_date<=m+interval '1 month - 1 day'and(exit_date is null or exit_date>=m))then raise exception 'Employee outside payroll employment period'using errcode='23514';end if;
 if a is null then
 if p->>'kind'<>'overtime'and coalesce((p->>'overtimeMinutes')::integer,0)<>0 then raise exception 'Overtime minutes require overtime adjustment'using errcode='22023';end if;
 insert into public.payroll_adjustments(company_id,employee_id,month,kind,amount_minor,overtime_minutes,reference,review_note,reviewed_by)values(c,e,m,p->>'kind',(p->>'amountMinor')::bigint,coalesce((p->>'overtimeMinutes')::integer,0),p->>'reference',p->>'reviewNote',auth.uid())returning id into a;
 else if length(trim(coalesce(p->>'reason','')))not between 1 and 2000 then raise exception 'Adjustment correction reason required'using errcode='22023';end if;update public.payroll_adjustments set status='Cancelled',version=version+1 where company_id=c and id=a and status='Reviewed';if not found then raise exception 'Adjustment already cancelled'using errcode='23514';end if;end if;
 perform public.audit_event(c,'Payroll Adjustment Reviewed','employee',e,jsonb_build_object('adjustmentId',a,'month',m,'kind',p->>'kind','reference',p->>'reference','reason',p->>'reason'));return a;
end $$;
alter table public.payroll_adjustments enable row level security;revoke all on public.payroll_adjustments from anon,authenticated;grant select on public.payroll_adjustments to authenticated;
create policy adjustment_read on public.payroll_adjustments for select to authenticated using(public.has_permission(company_id,'salary.read'));
create trigger adjustment_payroll_input_changed after insert or update on public.payroll_adjustments for each row execute function public.track_payroll_inputs();
create function public.payroll_round(c uuid,value numeric)returns numeric language sql stable security definer set search_path=''as $$select case when(select settings#>>'{payroll,rounding}'from public.company_settings where company_id=c)='down'then trunc(value)else round(value)end$$;
alter function public.validate_payroll(uuid,date)rename to validate_payroll_before_adjustments;revoke all on function public.validate_payroll_before_adjustments(uuid,date)from public,anon,authenticated;
create function public.validate_payroll(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$declare checks jsonb;issues jsonb;emp record;begin
 checks:=public.validate_payroll_before_adjustments(c,m);issues:=checks->'issues';
 for emp in select e.id,coalesce(sum(a.overtime_minutes),0)minutes from public.employees e left join public.attendance_records a on a.company_id=e.company_id and a.employee_id=e.id and a.date between greatest(m,e.joining_date)and least((m+interval '1 month - 1 day')::date,coalesce(e.exit_date,(m+interval '1 month - 1 day')::date))where e.company_id=c and e.status not in('Inactive','Salary Hold')and e.joining_date<=m+interval '1 month - 1 day'and(e.exit_date is null or e.exit_date>=m)group by e.id loop
 if emp.minutes<>(select coalesce(sum(overtime_minutes),0)from public.payroll_adjustments where company_id=c and employee_id=emp.id and month=m and kind='overtime'and status='Reviewed')then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Overtime Review','severity','Blocking Error','message','Review the recorded overtime minutes and period amount before calculating payroll. Reviewed minutes must match attendance.'));end if;end loop;
 return checks||jsonb_build_object('issues',issues,'blockingErrors',jsonb_array_length(issues),'passed',case when jsonb_array_length(issues)=0 then(checks->>'totalChecked')::integer else 0 end);
end $$;
do $$declare definition text;changed text;insertion text;begin
 definition:=pg_get_functiondef('public.calculate_payroll(uuid,date)'::regprocedure);
 insertion:=$patch$
  for item in select adjustment.kind,sum(adjustment.amount_minor)::bigint amount from public.payroll_adjustments adjustment where adjustment.company_id=c and adjustment.employee_id=emp.id and adjustment.month=m and adjustment.status='Reviewed'group by adjustment.kind loop
   if item.kind='otherDeduction'then deductions:=deductions||jsonb_build_object(item.kind,coalesce((deductions->>item.kind)::bigint,0)+item.amount);deduct:=deduct+item.amount;
   else amounts:=amounts||jsonb_build_object(item.kind,coalesce((amounts->>item.kind)::bigint,0)+item.amount);gross:=gross+item.amount;baseline_gross:=baseline_gross+item.amount;end if;
  end loop;
$patch$;
 changed:=replace(definition,'  select * into stat from public.employee_statutory_details where company_id=c and employee_id=emp.id;',insertion||'  select * into stat from public.employee_statutory_details where company_id=c and employee_id=emp.id;');if changed=definition then raise exception 'Unexpected payroll engine adjustment insertion point';end if;
 changed:=replace(changed,'round(','public.payroll_round(c,');
 changed:=replace(changed,'''salary'',salary_snapshot,''attendance'',attendance_snapshot','''adjustments'',(select coalesce(jsonb_agg(to_jsonb(a)order by a.id),''[]''::jsonb)from public.payroll_adjustments a where a.company_id=c and a.employee_id=emp.id and a.month=m and a.status=''Reviewed''),''salary'',salary_snapshot,''attendance'',attendance_snapshot');execute changed;
 definition:=pg_get_functiondef('public.validate_payroll_before_adjustments(uuid,date)'::regprocedure);changed:=replace(definition,'settings#>>''{payroll,rounding}''<>''half-up''','settings#>>''{payroll,rounding}''not in(''half-up'',''down'')');if changed=definition then raise exception 'Unexpected rounding validation';end if;changed:=replace(changed,'calendar-day proration and half-up rounding','calendar-day proration and half-up or down rounding');execute changed;
end $$;
revoke all on function public.save_payroll_adjustment(uuid,jsonb),public.payroll_round(uuid,numeric),public.validate_payroll(uuid,date)from public,anon,authenticated;
grant execute on function public.save_payroll_adjustment(uuid,jsonb),public.validate_payroll(uuid,date)to authenticated;
create function public.payroll_workflow_status(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$declare run public.payroll_runs;b public.disbursement_batches;published boolean:=false;paid boolean:=false;posted boolean:=false;begin
 perform public.require_permission(c,'payroll.run');select * into run from public.payroll_runs where company_id=c and month=m;
 if found then
 published:=exists(select 1 from public.payroll_run_employees where company_id=c and run_id=run.id)and not exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=run.id and not exists(select 1 from public.payslips p where p.company_id=c and p.run_id=run.id and p.employee_id=e.employee_id and p.run_version=run.version and p.status='Published'));
 posted:=exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id and status='Posted');
 select * into b from public.disbursement_batches where company_id=c and run_id=run.id and run_version=run.version and status='Prepared';
 if found then paid:=exists(select 1 from public.disbursement_items where company_id=c and batch_id=b.id)and not exists(select 1 from public.disbursement_items i where i.company_id=c and i.batch_id=b.id and i.amount_minor<>(select coalesce(sum(t.amount_minor),0)from public.disbursement_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.batch_id=b.id and p.employee_id=i.employee_id and t.status='Confirmed'));end if;
 end if;return jsonb_build_object('published',published,'disbursed',paid,'posted',posted);
end $$;
revoke all on function public.payroll_workflow_status(uuid,date)from public,anon,authenticated;grant execute on function public.payroll_workflow_status(uuid,date)to authenticated;
commit;
