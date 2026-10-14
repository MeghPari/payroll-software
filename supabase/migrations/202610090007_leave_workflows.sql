begin;
create table public.leave_types (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),name text not null,paid boolean not null,
 working_days smallint[] not null check(cardinality(working_days)between 1 and 7 and working_days<@array[1,2,3,4,5,6,7]::smallint[]),
 unique(company_id,id),unique(company_id,name)
);
create table public.holidays (company_id uuid not null references public.companies(id),date date not null,name text not null,primary key(company_id,date));
create table public.employee_leave_balances (
 company_id uuid not null,employee_id uuid not null,type_id uuid not null,period_start date not null,period_end date not null check(period_end>=period_start),
 allocated_days numeric(7,2)not null check(allocated_days>=0),used_days numeric(7,2)not null default 0 check(used_days>=0 and used_days<=allocated_days),
 primary key(company_id,employee_id,type_id,period_start),foreign key(company_id,employee_id)references public.employees(company_id,id),foreign key(company_id,type_id)references public.leave_types(company_id,id)
);
create table public.leave_requests (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,employee_id uuid not null,type_id uuid not null,
 from_date date not null,to_date date not null check(to_date>=from_date),days integer not null check(days>0),reason text not null check(length(reason)>0),
 status text not null default 'Pending'check(status in('Pending','Approved','Rejected')),applied_by uuid not null references public.user_profiles(id),applied_at timestamptz not null default now(),
 unique(company_id,id),foreign key(company_id,employee_id)references public.employees(company_id,id),foreign key(company_id,type_id)references public.leave_types(company_id,id)
);
create table public.leave_approvals (
 id uuid primary key default gen_random_uuid(),company_id uuid not null,request_id uuid not null,actor_id uuid not null references public.user_profiles(id),
 status text not null check(status in('Approved','Rejected')),created_at timestamptz not null default now(),foreign key(company_id,request_id)references public.leave_requests(company_id,id)
);
create function public.save_leave_policy(c uuid,name_text text,is_paid boolean,weekdays smallint[])returns uuid
language plpgsql security definer set search_path=''as $$declare tid uuid;begin
 perform public.require_permission(c,'leave.write');
 insert into public.leave_types(company_id,name,paid,working_days)values(c,name_text,is_paid,weekdays)on conflict(company_id,name)do update set paid=excluded.paid,working_days=excluded.working_days returning id into tid;
 perform public.audit_event(c,'Leave Policy Saved','leave_type',tid);return tid;
end $$;
create function public.allocate_leave(c uuid,e uuid,t uuid,start_date date,end_date date,days_value numeric)returns void
language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'leave.write');perform 1 from public.companies where id=c for update;
 if exists(select 1 from public.employee_leave_balances where company_id=c and employee_id=e and type_id=t and period_start<>start_date and period_start<=end_date and period_end>=start_date)then raise exception 'Overlapping balance period'using errcode='23514';end if;
 insert into public.employee_leave_balances(company_id,employee_id,type_id,period_start,period_end,allocated_days)values(c,e,t,start_date,end_date,days_value)
 on conflict(company_id,employee_id,type_id,period_start)do update set allocated_days=excluded.allocated_days,period_end=excluded.period_end;
 perform public.audit_event(c,'Leave Allocated','employee',e,jsonb_build_object('type',t,'days',days_value));
end $$;
create function public.request_leave(c uuid,e uuid,t uuid,start_date date,end_date date,reason_text text)returns uuid
language plpgsql security definer set search_path=''as $$declare emp public.employees;policy public.leave_types;n integer;rid uuid;begin
 if not public.is_member(c)then raise exception 'Permission denied'using errcode='42501';end if;
 select * into emp from public.employees where company_id=c and id=e;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;
 if emp.user_id is distinct from auth.uid()and not public.has_permission(c,'leave.write')then raise exception 'Own employee only'using errcode='42501';end if;
 if end_date<start_date or end_date-start_date>366 or start_date<emp.joining_date or(emp.exit_date is not null and end_date>emp.exit_date)then raise exception 'Invalid leave dates'using errcode='22023';end if;
 select * into policy from public.leave_types where company_id=c and id=t;if not found then raise exception 'Configure leave policy'using errcode='P0002';end if;
 perform 1 from public.companies where id=c for update;
 if exists(select 1 from public.leave_requests where company_id=c and employee_id=e and status<>'Rejected'and from_date<=end_date and to_date>=start_date)then raise exception 'Overlapping leave'using errcode='23514';end if;
 select count(*)into n from generate_series(start_date,end_date,interval '1 day')d where extract(isodow from d)::smallint=any(policy.working_days)and not exists(select 1 from public.holidays h where h.company_id=c and h.date=d::date);
 insert into public.leave_requests(company_id,employee_id,type_id,from_date,to_date,days,reason,applied_by)values(c,e,t,start_date,end_date,n,reason_text,auth.uid())returning id into rid;
 perform public.audit_event(c,'Leave Requested','leave_request',rid);return rid;
end $$;
create function public.decide_leave(c uuid,r uuid,next_status text)returns void
language plpgsql security definer set search_path=''as $$declare req public.leave_requests;policy public.leave_types;begin
 perform public.require_permission(c,'leave.approve');perform 1 from public.companies where id=c for update;
 select * into req from public.leave_requests where company_id=c and id=r for update;if not found then raise exception 'Request not found'using errcode='P0002';end if;
 if not public.has_permission(c,'leave.write')and not exists(select 1 from public.employees emp join public.employees manager on manager.company_id=emp.company_id and manager.id=emp.manager_id where emp.company_id=c and emp.id=req.employee_id and manager.user_id=auth.uid())then raise exception 'Team access denied'using errcode='42501';end if;
 if req.status<>'Pending'or next_status not in('Approved','Rejected')then raise exception 'Invalid leave transition'using errcode='23514';end if;
 if next_status='Approved'then
  select * into policy from public.leave_types where company_id=c and id=req.type_id;
  if exists(select 1 from public.attendance_periods where company_id=c and finalized_at is not null and month<=req.to_date and(month+interval '1 month - 1 day')::date>=req.from_date)then raise exception 'Attendance period finalized'using errcode='23514';end if;
  if policy.paid then
   update public.employee_leave_balances set used_days=used_days+req.days where company_id=c and employee_id=req.employee_id and type_id=req.type_id and period_start<=req.from_date and period_end>=req.to_date;
   if not found then raise exception 'Allocate leave balance first'using errcode='23514';end if;
  end if;
 end if;
 update public.leave_requests set status=next_status where company_id=c and id=r;
 insert into public.leave_approvals(company_id,request_id,actor_id,status)values(c,r,auth.uid(),next_status);
 perform public.audit_event(c,'Leave '||next_status,'leave_request',r);
end $$;
do $$declare t text;begin foreach t in array array['leave_types','holidays','employee_leave_balances','leave_requests','leave_approvals']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);end loop;end $$;
create policy leave_type_read on public.leave_types for select to authenticated using(public.is_member(company_id));
create policy holiday_read on public.holidays for select to authenticated using(public.is_member(company_id));
create policy leave_balance_read on public.employee_leave_balances for select to authenticated using(public.can_read_employee(company_id,employee_id));
create policy leave_request_read on public.leave_requests for select to authenticated using(public.can_read_employee(company_id,employee_id));
create policy leave_approval_read on public.leave_approvals for select to authenticated using(public.has_permission(company_id,'leave.approve')and exists(select 1 from public.leave_requests r where r.company_id=leave_approvals.company_id and r.id=leave_approvals.request_id));
revoke all on function public.save_leave_policy(uuid,text,boolean,smallint[]),public.allocate_leave(uuid,uuid,uuid,date,date,numeric),public.request_leave(uuid,uuid,uuid,date,date,text),public.decide_leave(uuid,uuid,text)from public,anon,authenticated;
grant execute on function public.save_leave_policy(uuid,text,boolean,smallint[]),public.allocate_leave(uuid,uuid,uuid,date,date,numeric),public.request_leave(uuid,uuid,uuid,date,date,text),public.decide_leave(uuid,uuid,text)to authenticated;
commit;
