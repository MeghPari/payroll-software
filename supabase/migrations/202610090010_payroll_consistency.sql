begin;
alter table public.companies add column payroll_input_version bigint not null default 1;
alter table public.payroll_runs add column input_version bigint;

-- Serialize financial input mutations with calculation, including concurrent RPCs.
create function public.track_payroll_inputs()returns trigger
language plpgsql security definer set search_path=''as $$declare c uuid;begin
 c:=case when tg_op='DELETE'then old.company_id else new.company_id end;
 update public.companies set payroll_input_version=payroll_input_version+1 where id=c;
 if tg_op='DELETE'then return old;end if;return new;
end $$;
do $$declare t text;begin foreach t in array array['employees','employee_bank_details','employee_statutory_details','employee_salary_assignments','employee_salary_component_values','attendance_records','attendance_periods','salary_holds','company_statutory_settings']loop
 execute format('create trigger payroll_input_changed after insert or update or delete on public.%I for each row execute function public.track_payroll_inputs()',t);
end loop;end $$;

create function public.check_payroll_revision()returns trigger
language plpgsql security definer set search_path=''as $$declare current_revision bigint;begin
 select payroll_input_version into current_revision from public.companies where id=new.company_id for update;
 if new.status='Calculated'and old.status in('Draft','Calculated')then
  new.input_version:=current_revision;
 elsif new.status='Approved'and old.status='Calculated'then
  if new.input_version is distinct from current_revision then raise exception 'Payroll inputs changed; recalculate before approval'using errcode='40001';end if;
 end if;
 return new;
end $$;
create trigger payroll_revision_check before update on public.payroll_runs for each row execute function public.check_payroll_revision();

-- A finalized attendance period cannot be reopened behind approved snapshots.
create function public.protect_approved_attendance()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if old.finalized_at is not null and new.finalized_at is null and exists(select 1 from public.payroll_runs where company_id=new.company_id and month=new.month and status in('Approved','Locked'))then
  raise exception 'Unlock payroll with an audited reason before reopening attendance'using errcode='23514';
 end if;return new;
end $$;
create trigger approved_attendance_guard before update on public.attendance_periods for each row execute function public.protect_approved_attendance();
revoke all on function public.track_payroll_inputs(),public.check_payroll_revision(),public.protect_approved_attendance()from public,anon,authenticated;
commit;
