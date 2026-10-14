begin;
-- Mutations also validate sensitive write permission at the database boundary.
-- Wrapping the original RPC keeps its atomic audit and tenant-qualified FKs.
alter function public.save_employee(uuid,jsonb,uuid,integer) rename to save_employee_internal;
revoke all on function public.save_employee_internal(uuid,jsonb,uuid,integer) from public,anon,authenticated;
create function public.save_employee(c uuid,p jsonb,employee_uuid uuid default null,expected_version integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 if p ? 'bankDetails' or p ? 'statutory' then perform public.require_permission(c,'employees.sensitive'); end if;
 return public.save_employee_internal(c,p,employee_uuid,expected_version);
end $$;
revoke all on function public.save_employee(uuid,jsonb,uuid,integer) from public,anon,authenticated;
grant execute on function public.save_employee(uuid,jsonb,uuid,integer) to authenticated;

-- Audit and settings writes happen in the same transaction; API clients cannot write tables.
create function public.save_company_settings(c uuid,p jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.require_permission(c,'settings.write');
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Invalid settings' using errcode='22023'; end if;
 insert into public.company_settings(company_id,settings) values(c,p)
 on conflict(company_id) do update set settings=excluded.settings,updated_at=now();
 perform public.audit_event(c,'Settings Updated','company',c);
end $$;
revoke all on function public.save_company_settings(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_company_settings(uuid,jsonb) to authenticated;

-- Lifecycle dates are evaluated in the company's local timezone, not UTC session date.
create or replace function public.change_employee_status(c uuid,e uuid,next_status text,effective date,reason_text text,remarks_text text default '')
returns void language plpgsql security definer set search_path='' as $$
declare old public.employees; local_today date;
begin
 perform public.require_permission(c,'employees.write');
 select (now() at time zone timezone)::date into local_today from public.companies where id=c;
 select * into old from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found' using errcode='P0002'; end if;
 if effective<>local_today then raise exception 'Only changes effective today are supported' using errcode='22023'; end if;
 if old.status=next_status then raise exception 'Status already applied' using errcode='22023'; end if;
 update public.employees set status=next_status,exit_date=case when next_status='Exited' then effective else null end,version=version+1,updated_at=now() where company_id=c and id=e;
 insert into public.employee_status_history(company_id,employee_id,previous_status,new_status,effective_date,reason,remarks,changed_by)
 values(c,e,old.status,next_status,effective,reason_text,remarks_text,auth.uid());
 perform public.audit_event(c,'Employee Status Changed','employee',e,jsonb_build_object('previous',old.status,'next',next_status,'effectiveDate',effective));
end $$;
commit;
