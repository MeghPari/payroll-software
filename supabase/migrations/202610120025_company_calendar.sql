begin;
alter table public.companies add column version integer not null default 1,add column profile jsonb not null default '{}';
alter table public.company_settings add column version integer not null default 1;
create function public.save_company_profile(c uuid,expected_version integer,p jsonb)returns void language plpgsql security definer set search_path=''as $$declare v integer;begin
 perform public.require_permission(c,'settings.write');perform 1 from public.companies where id=c for update;select version into v from public.companies where id=c;
 if expected_version is null or v<>expected_version then raise exception 'Company changed; refresh'using errcode='40001';end if;
 if length(trim(coalesce(p->>'name','')))not between 1 and 160 or length(coalesce(p->>'address',''))>1000 or length(coalesce(p->>'email',''))>254 or coalesce(p->>'gstin','')!~'^(?:[A-Z0-9]{15})?$'then raise exception 'Invalid company profile'using errcode='22023';end if;
 update public.companies set name=p->>'name',profile=p-'name',version=version+1 where id=c;
 perform public.audit_event(c,'Company Profile Updated','company',c,'{}');
end $$;
create function public.save_versioned_company_settings(c uuid,p jsonb,expected_version integer)returns void language plpgsql security definer set search_path=''as $$declare v integer;begin
 perform public.require_permission(c,'settings.write');perform 1 from public.companies where id=c for update;select version into v from public.company_settings where company_id=c;
 if expected_version is null or v<>expected_version then raise exception 'Settings changed; refresh'using errcode='40001';end if;
 perform public.save_company_settings(c,p);update public.company_settings set version=version+1 where company_id=c;
end $$;
revoke all on function public.save_company_settings(uuid,jsonb)from authenticated;
create function public.set_employee_manager(c uuid,e uuid,manager uuid,expected_version integer)returns void language plpgsql security definer set search_path=''as $$declare v integer;begin
 perform public.require_permission(c,'employees.write');perform 1 from public.companies where id=c for update;select version into v from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;if expected_version is null or v<>expected_version then raise exception 'Employee changed; refresh'using errcode='40001';end if;
 if manager=e or(manager is not null and not exists(select 1 from public.employees where company_id=c and id=manager and status not in('Exited','Inactive')))then raise exception 'Active company manager required'using errcode='23514';end if;
 if exists(with recursive chain as(select id,manager_id from public.employees where company_id=c and id=manager union select parent.id,parent.manager_id from public.employees parent join chain on parent.id=chain.manager_id where parent.company_id=c)select 1 from chain where id=e)then raise exception 'Reporting relationship cycle'using errcode='23514';end if;
 update public.employees set manager_id=manager,version=version+1,updated_at=now()where company_id=c and id=e;
 perform public.audit_event(c,'Reporting Manager Changed','employee',e,jsonb_build_object('managerId',manager));
end $$;
create table public.work_schedules(id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid,effective_from date not null,effective_to date check(effective_to>=effective_from),working_days integer[]not null check(cardinality(working_days)between 1 and 7 and working_days<@array[0,1,2,3,4,5,6]),start_time time,review_reference text not null check(length(trim(review_reference))between 1 and 1000),created_by uuid not null references public.user_profiles(id),foreign key(company_id)references public.companies(id),foreign key(company_id,employee_id)references public.employees(company_id,id));
alter table public.holidays add column id uuid not null default gen_random_uuid()unique,add column review_reference text,add column created_by uuid references public.user_profiles(id),add column active boolean not null default true,add column version integer not null default 1;
alter table public.work_schedules add column active boolean not null default true,add column version integer not null default 1;
create function public.save_work_calendar(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;e uuid;start_date date;end_date date;begin
 perform public.require_permission(c,'attendance.write');perform 1 from public.companies where id=c for update;
 if p->>'kind'='holiday'then insert into public.holidays(company_id,date,name,review_reference,created_by)values(c,(p->>'date')::date,p->>'name',p->>'reviewReference',auth.uid())on conflict(company_id,date)do update set name=excluded.name,review_reference=excluded.review_reference,created_by=excluded.created_by,active=true,version=holidays.version+1 where not holidays.active returning id into rid;if rid is null then raise exception 'Holiday already configured'using errcode='23505';end if;
 elsif p->>'kind'='schedule'then e:=nullif(p->>'employeeId','')::uuid;start_date:=(p->>'effectiveFrom')::date;end_date:=nullif(p->>'effectiveTo','')::date;
 if exists(select 1 from public.work_schedules where company_id=c and active and employee_id is not distinct from e and effective_from<=coalesce(end_date,'infinity'::date)and coalesce(effective_to,'infinity'::date)>=start_date)then raise exception 'Schedule periods overlap'using errcode='23514';end if;
 insert into public.work_schedules(company_id,employee_id,effective_from,effective_to,working_days,start_time,review_reference,created_by)values(c,e,start_date,end_date,array(select value::integer from jsonb_array_elements_text(p->'workingDays')),nullif(p->>'startTime','')::time,p->>'reviewReference',auth.uid())returning id into rid;
 else raise exception 'Unknown calendar operation'using errcode='22023';end if;
 perform public.audit_event(c,'Work Calendar Configured','calendar',rid,jsonb_build_object('kind',p->>'kind'));return rid;
end $$;
create function public.apply_nonworking_attendance(c uuid,m date)returns integer language plpgsql security definer set search_path=''as $$declare emp public.employees;d date;s public.work_schedules;holiday_name text;rows jsonb;affected integer:=0;begin
 perform public.require_permission(c,'attendance.write');perform 1 from public.companies where id=c for update;
 if extract(day from m)<>1 then raise exception 'Month start required'using errcode='22023';end if;
 for emp in select * from public.employees where company_id=c and status not in('Inactive','Salary Hold')and joining_date<=m+interval '1 month - 1 day'and(exit_date is null or exit_date>=m)loop
 rows:='[]';
 for d in select day::date from generate_series(greatest(m,emp.joining_date),least((m+interval '1 month - 1 day')::date,coalesce(emp.exit_date,(m+interval '1 month - 1 day')::date)),interval '1 day')day loop
 if exists(select 1 from public.attendance_records where company_id=c and employee_id=emp.id and date=d)then continue;end if;
 select name into holiday_name from public.holidays where company_id=c and active and date=d and review_reference is not null limit 1;
 select * into s from public.work_schedules where company_id=c and active and(employee_id is null or employee_id=emp.id)and effective_from<=d and(effective_to is null or effective_to>=d)order by(employee_id is not null)desc,effective_from desc limit 1;
 if holiday_name is not null or(s.id is not null and not(extract(dow from d)::integer=any(s.working_days)))then rows:=rows||jsonb_build_array(jsonb_build_object('employeeId',emp.id,'date',d,'status',case when holiday_name is not null then 'Holiday'else 'Weekly Off'end,'remarks',coalesce(holiday_name,'Reviewed work schedule weekly off')));end if;
 end loop;
 if jsonb_array_length(rows)>0 then affected:=affected+public.save_attendance(c,rows,'Reviewed calendar nonworking days',false);end if;
 end loop;
 perform public.audit_event(c,'Nonworking Attendance Applied','attendance_period',null,jsonb_build_object('month',m,'rows',affected));return affected;
end $$;
alter table public.work_schedules enable row level security;alter table public.holidays enable row level security;
revoke all on public.work_schedules,public.holidays from anon,authenticated;grant select on public.work_schedules,public.holidays to authenticated;
create policy work_schedule_read on public.work_schedules for select to authenticated using(public.has_permission(company_id,'attendance.read')or public.has_permission(company_id,'attendance.write'));

revoke all on function public.save_company_profile(uuid,integer,jsonb),public.save_versioned_company_settings(uuid,jsonb,integer),public.set_employee_manager(uuid,uuid,uuid,integer),public.save_work_calendar(uuid,jsonb),public.apply_nonworking_attendance(uuid,date)from public,anon,authenticated;
grant execute on function public.save_company_profile(uuid,integer,jsonb),public.save_versioned_company_settings(uuid,jsonb,integer),public.set_employee_manager(uuid,uuid,uuid,integer),public.save_work_calendar(uuid,jsonb),public.apply_nonworking_attendance(uuid,date)to authenticated;
alter table public.attendance_records add column scheduled_start time;
create function public.capture_attendance_schedule()returns trigger language plpgsql security definer set search_path=''as $$begin
 select start_time into new.scheduled_start from public.work_schedules where company_id=new.company_id and active and(employee_id is null or employee_id=new.employee_id)and effective_from<=new.date and(effective_to is null or effective_to>=new.date)and extract(dow from new.date)::integer=any(working_days)order by(employee_id is not null)desc,effective_from desc limit 1;return new;
end $$;
create trigger capture_attendance_schedule before insert or update on public.attendance_records for each row execute function public.capture_attendance_schedule();
create or replace function public.payslip_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare u uuid;enabled boolean;begin
 if new.status<>'Published'then return new;end if;if tg_op='UPDATE'and old.status='Published'then return new;end if;
 select coalesce((settings#>>'{notifications,payroll}')::boolean,true)into enabled from public.company_settings where company_id=new.company_id;if enabled is false then return new;end if;
 select user_id into u from public.employees where company_id=new.company_id and id=new.employee_id;if u is not null then perform public.notify_member(new.company_id,u,'Your payslip for '||to_char(new.month,'YYYY-MM')||' is available','/payslips','payslip:'||new.id);end if;return new;
end $$;
create function public.leave_decision_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare u uuid;enabled boolean;begin
 if new.status=old.status or new.status='Pending'then return new;end if;
 select coalesce((settings#>>'{notifications,leave}')::boolean,true)into enabled from public.company_settings where company_id=new.company_id;if enabled is false then return new;end if;
 select user_id into u from public.employees where company_id=new.company_id and id=new.employee_id;if u is not null then perform public.notify_member(new.company_id,u,'Your leave request was '||lower(new.status),'/attendance','leave:'||new.id||':'||new.status);end if;return new;
end $$;
create trigger leave_decision_notifications after update on public.leave_requests for each row execute function public.leave_decision_notifications();
revoke all on function public.capture_attendance_schedule(),public.payslip_notifications(),public.leave_decision_notifications()from public,anon,authenticated;
create function public.retire_work_calendar(c uuid,kind text,r uuid,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare n integer;begin
 perform public.require_permission(c,'attendance.write');perform 1 from public.companies where id=c for update;
 if expected_version is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Version and reason required'using errcode='22023';end if;
 if kind='holiday'then update public.holidays set active=false,version=version+1 where company_id=c and id=r and active and version=expected_version;
 elsif kind='schedule'then update public.work_schedules set active=false,version=version+1 where company_id=c and id=r and active and version=expected_version;
 else raise exception 'Calendar kind required'using errcode='22023';end if;
 get diagnostics n=row_count;if n<>1 then raise exception 'Calendar changed; refresh'using errcode='40001';end if;
 perform public.audit_event(c,'Work Calendar Retired','calendar',r,jsonb_build_object('kind',kind,'reason',reason_text));
end $$;
revoke all on function public.retire_work_calendar(uuid,text,uuid,integer,text)from public,anon,authenticated;grant execute on function public.retire_work_calendar(uuid,text,uuid,integer,text)to authenticated;
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.request_leave(uuid,uuid,uuid,date,date,text)'::regprocedure);changed:=replace(definition,'h.company_id=c and h.date=d::date','h.company_id=c and h.date=d::date and h.active');if changed=definition then raise exception 'Unexpected leave holiday query';end if;execute changed;
 definition:=pg_get_functiondef('public.apply_approved_leave()'::regprocedure);changed:=replace(definition,'where company_id=new.company_id and date=value::date','where company_id=new.company_id and date=value::date and active');if changed=definition then raise exception 'Unexpected approved leave holiday query';end if;execute changed;
end $$;
commit;
