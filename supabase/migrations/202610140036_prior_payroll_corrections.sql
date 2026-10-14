begin;
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
commit;
