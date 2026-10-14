begin;
create table public.attendance_import_batches(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),actor_id uuid not null references public.user_profiles(id),
 row_count integer not null check(row_count>0),created_at timestamptz not null default now()
);
alter table public.attendance_import_batches enable row level security;revoke all on public.attendance_import_batches from anon,authenticated;grant select on public.attendance_import_batches to authenticated;
create policy attendance_import_read on public.attendance_import_batches for select to authenticated using(public.has_permission(company_id,'attendance.read'));
create function public.import_attendance(c uuid,rows_json jsonb,reason_text text)returns uuid
language plpgsql security definer set search_path=''as $$declare n integer;bid uuid;begin
 n:=public.save_attendance(c,rows_json,reason_text,false);
 insert into public.attendance_import_batches(company_id,actor_id,row_count)values(c,auth.uid(),n)returning id into bid;
 perform public.audit_event(c,'Attendance Imported','attendance_import',bid,jsonb_build_object('rows',n));return bid;
end $$;
revoke all on function public.import_attendance(uuid,jsonb,text)from public,anon,authenticated;grant execute on function public.import_attendance(uuid,jsonb,text)to authenticated;
commit;
