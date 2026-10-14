begin;
create function public.save_statutory_rule(c uuid,p jsonb)returns uuid
language plpgsql security definer set search_path=''as $$declare rid uuid;start_date date:=(p->>'effectiveFrom')::date;end_date date:=(p->>'effectiveTo')::date;kind text:=p->>'code';state_text text:=coalesce(p->>'state','');components text[];begin
 perform public.require_permission(c,'settings.write');perform 1 from public.companies where id=c for update;
 if end_date is null or end_date<start_date or length(trim(coalesce(p->>'verificationReference','')))=0 then raise exception 'Reviewed date range and reference required'using errcode='22023';end if;
 select array_agg(value)into components from jsonb_array_elements_text(p->'wageComponents');
 if components is null or exists(select 1 from unnest(components)w(component_code) where not exists(select 1 from public.salary_components where salary_components.code=w.component_code and salary_components.kind='earning'))then raise exception 'Invalid wage components'using errcode='22023';end if;
 if exists(select 1 from public.company_statutory_settings where company_id=c and code=kind and state=state_text and effective_from<=end_date and coalesce(effective_to,'infinity'::date)>=start_date)then raise exception 'Overlapping rule period'using errcode='23514';end if;
 insert into public.company_statutory_settings(company_id,code,state,effective_from,effective_to,wage_components,employee_basis_points,employer_basis_points,wage_cap_minor,fixed_minor,verified_by,verification_reference)
 values(c,kind,state_text,start_date,end_date,components,(p->>'employeeBasisPoints')::integer,coalesce((p->>'employerBasisPoints')::integer,0),(p->>'wageCapMinor')::bigint,coalesce((p->>'fixedMinor')::bigint,0),auth.uid(),p->>'verificationReference')returning id into rid;
 perform public.audit_event(c,'Statutory Rule Reviewed','statutory_rule',rid,jsonb_build_object('code',kind,'effectiveFrom',start_date,'effectiveTo',end_date));return rid;
end $$;
revoke all on function public.save_statutory_rule(uuid,jsonb)from public,anon,authenticated;grant execute on function public.save_statutory_rule(uuid,jsonb)to authenticated;

-- Recheck completeness after roster changes, rather than trusting an old finalization.
alter function public.validate_payroll(uuid,date)rename to validate_payroll_internal;
revoke all on function public.validate_payroll_internal(uuid,date)from public,anon,authenticated;
create function public.validate_payroll(c uuid,m date)returns jsonb
language plpgsql security definer set search_path=''as $$declare checks jsonb;issues jsonb;emp record;settings jsonb;begin
 checks:=public.validate_payroll_internal(c,m);issues:=checks->'issues';
 select s.settings into settings from public.company_settings s where company_id=c;
 if settings is not null and ((settings#>>'{payroll,proration}'is not null and settings#>>'{payroll,proration}'<>'calendar')or(settings#>>'{payroll,rounding}'is not null and settings#>>'{payroll,rounding}'<>'half-up'))then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId','','check','Payroll Configuration','severity','Blocking Error','message','This calculation supports calendar-day proration and half-up rounding. Configure these explicitly or use a reviewed calculation implementation.'));end if;
 for emp in select e.id from public.employees e where e.company_id=c and e.status not in('Inactive','Salary Hold')and exists(select 1 from generate_series(greatest(m,e.joining_date),least((m+interval '1 month - 1 day')::date,coalesce(e.exit_date,(m+interval '1 month - 1 day')::date)),interval '1 day')d where not exists(select 1 from public.attendance_records a where a.company_id=c and a.employee_id=e.id and a.date=d::date and a.status<>'Missing Punch'))loop
  issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'check','Attendance Missing','severity','Blocking Error','message','Complete attendance for every employment day, including roster changes after finalization.'));
 end loop;
 return checks||jsonb_build_object('issues',issues,'blockingErrors',jsonb_array_length(issues),'passed',case when jsonb_array_length(issues)=0 then(checks->>'totalChecked')::integer else 0 end);
end $$;
revoke all on function public.validate_payroll(uuid,date)from public,anon,authenticated;grant execute on function public.validate_payroll(uuid,date)to authenticated;
create trigger settings_payroll_input_changed after insert or update or delete on public.company_settings for each row execute function public.track_payroll_inputs();
commit;
