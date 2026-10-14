begin;
create table public.employee_exit_details(company_id uuid not null,employee_id uuid not null,effective_date date not null,last_working_date date not null check(last_working_date<=effective_date),exit_type text not null check(exit_type in('Resignation','Termination','Retirement','Contract Completed','Absconding','Other')),settlement_status text not null check(settlement_status in('Not Started','In Progress','Completed')),reason text not null,remarks text not null default '',primary key(company_id,employee_id),foreign key(company_id,employee_id)references public.employees(company_id,id));
alter function public.change_employee_status(uuid,uuid,text,date,text,text)rename to change_employee_status_internal;
revoke all on function public.change_employee_status_internal(uuid,uuid,text,date,text,text)from public,anon,authenticated;
create function public.change_employment_status(c uuid,e uuid,next_status text,effective date,reason_text text,remarks_text text,expected_version integer,exit_json jsonb default null)returns void
language plpgsql security definer set search_path=''as $$declare old public.employees;last_day date;begin
 perform public.require_permission(c,'employees.write');perform 1 from public.companies where id=c for update;select * into old from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;if expected_version is null or old.version<>expected_version then raise exception 'Employee changed; refresh'using errcode='40001';end if;
 if next_status='Exited'then
  last_day:=(exit_json->>'lastWorkingDate')::date;
  if last_day is null or last_day>effective or last_day<old.joining_date then raise exception 'Valid last working date required'using errcode='22023';end if;
 elsif exit_json is not null then raise exception 'Exit details require exited status'using errcode='22023';end if;
 perform public.change_employee_status_internal(c,e,next_status,effective,reason_text,remarks_text);
 if next_status='Exited'then
  insert into public.employee_exit_details(company_id,employee_id,effective_date,last_working_date,exit_type,settlement_status,reason,remarks)values(c,e,effective,last_day,exit_json->>'exitType',exit_json->>'settlementStatus',reason_text,remarks_text)
  on conflict(company_id,employee_id)do update set effective_date=excluded.effective_date,last_working_date=excluded.last_working_date,exit_type=excluded.exit_type,settlement_status=excluded.settlement_status,reason=excluded.reason,remarks=excluded.remarks;
  update public.employees set exit_date=last_day where company_id=c and id=e;
  perform public.audit_event(c,'Exit Details Saved','employee',e,jsonb_build_object('lastWorkingDate',last_day,'exitType',exit_json->>'exitType','settlementStatus',exit_json->>'settlementStatus'));
 end if;
end $$;
alter table public.employee_exit_details enable row level security;revoke all on public.employee_exit_details from anon,authenticated;grant select on public.employee_exit_details to authenticated;
create policy exit_read on public.employee_exit_details for select to authenticated using(public.can_read_employee(company_id,employee_id));
revoke all on function public.change_employment_status(uuid,uuid,text,date,text,text,integer,jsonb)from public,anon,authenticated;grant execute on function public.change_employment_status(uuid,uuid,text,date,text,text,integer,jsonb)to authenticated;
commit;
