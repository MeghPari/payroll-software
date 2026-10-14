begin;
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
