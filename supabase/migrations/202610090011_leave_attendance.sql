begin;
create function public.apply_approved_leave()returns trigger
language plpgsql security definer set search_path=''as $$declare policy public.leave_types;d date;begin
 if new.status='Approved'and old.status='Pending'then
  select * into policy from public.leave_types where company_id=new.company_id and id=new.type_id;
  for d in select value::date from generate_series(new.from_date,new.to_date,interval '1 day')value where extract(isodow from value)::smallint=any(policy.working_days)and not exists(select 1 from public.holidays where company_id=new.company_id and date=value::date)loop
   insert into public.attendance_periods(company_id,month)values(new.company_id,date_trunc('month',d)::date)on conflict do nothing;
   if exists(select 1 from public.attendance_periods where company_id=new.company_id and month=date_trunc('month',d)::date and finalized_at is not null)then raise exception 'Attendance is finalized'using errcode='23514';end if;
   insert into public.attendance_records(company_id,employee_id,date,status,leave_type,remarks,source,modified_by)
   values(new.company_id,new.employee_id,d,case when policy.paid then 'Paid Leave'else 'Unpaid Leave'end,policy.name,'Approved leave '||new.id,'Manual',auth.uid())
   on conflict(company_id,employee_id,date)do update set status=excluded.status,leave_type=excluded.leave_type,remarks=excluded.remarks,check_in=null,check_out=null,work_minutes=0,overtime_minutes=0,modified_by=auth.uid(),modified_at=now();
  end loop;
 end if;return new;
end $$;
create trigger approved_leave_attendance before update on public.leave_requests for each row execute function public.apply_approved_leave();
-- Preserve the policy that determined request day counts and paid classification.
create function public.protect_used_leave_policy()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if (old.paid is distinct from new.paid or old.working_days is distinct from new.working_days)and exists(select 1 from public.leave_requests where company_id=old.company_id and type_id=old.id)then raise exception 'Create a new policy version for a used leave policy'using errcode='23514';end if;return new;
end $$;
create trigger used_leave_policy_guard before update on public.leave_types for each row execute function public.protect_used_leave_policy();
revoke all on function public.apply_approved_leave(),public.protect_used_leave_policy()from public,anon,authenticated;
commit;
