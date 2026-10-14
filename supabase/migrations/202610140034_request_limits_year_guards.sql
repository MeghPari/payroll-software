begin;
create table public.application_request_limits(user_id uuid not null references public.user_profiles(id)on delete cascade,bucket text not null check(bucket in('read','write','download')),window_start bigint not null,used integer not null check(used>0),primary key(user_id,bucket));
alter table public.application_request_limits enable row level security;
revoke all on public.application_request_limits from anon,authenticated;
create function public.consume_application_request(c uuid,bucket_name text)returns jsonb language plpgsql security definer set search_path=''as $$declare epoch bigint;current_window bigint;quota integer;requests integer;begin
 if not public.is_member(c)then raise exception 'Permission denied'using errcode='42501';end if;
 quota:=case bucket_name when 'read'then 240 when 'write'then 60 when 'download'then 30 else null end;
 if quota is null then raise exception 'Invalid request bucket'using errcode='22023';end if;
 epoch:=floor(extract(epoch from clock_timestamp()))::bigint;current_window:=epoch/60;
 insert into public.application_request_limits(user_id,bucket,window_start,used)values(auth.uid(),bucket_name,current_window,1)
 on conflict(user_id,bucket)do update set window_start=excluded.window_start,used=case when application_request_limits.window_start=excluded.window_start then least(application_request_limits.used+1,quota+1)else 1 end returning used into requests;
 return jsonb_build_object('allowed',requests<=quota,'retrySeconds',case when requests<=quota then 0 else 60-epoch%60 end);
end $$;
revoke all on function public.consume_application_request(uuid,text)from public,anon,authenticated;grant execute on function public.consume_application_request(uuid,text)to authenticated;
create or replace function public.change_financial_year(c uuid,y uuid,close_year boolean,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare year public.financial_years;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into year from public.financial_years where company_id=c and id=y for update;
 if not found then raise exception 'Financial year not found'using errcode='P0002';end if;if expected_version is null or year.version<>expected_version then raise exception 'Financial year changed; refresh'using errcode='40001';end if;
 if close_year is null or reason_text is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Reason and status required'using errcode='22023';end if;
 if close_year and year.end_date>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Only completed financial years can close'using errcode='23514';end if;
 if close_year and(exists(select 1 from public.journal_entries where company_id=c and status='Draft'and date between year.start_date and year.end_date)or exists(select 1 from public.invoices where company_id=c and status='Draft'and date between year.start_date and year.end_date))then raise exception 'Resolve draft documents before closing year'using errcode='23514';end if;
 if close_year and exists(select 1 from public.payroll_runs r where r.company_id=c and r.month between date_trunc('month',year.start_date)::date and year.end_date and(r.status<>'Locked'or(exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=r.id and(e.gross_minor>0 or e.employer_minor>0))and not exists(select 1 from public.journal_entries j where j.company_id=c and j.source_type='payroll'and j.source_id=r.id and j.status='Posted'))))then raise exception 'Complete payroll and its accrual before closing year'using errcode='23514';end if;
 update public.financial_years set closed_at=case when close_year then now()else null end,closed_by=case when close_year then auth.uid()else null end,version=version+1 where company_id=c and id=y;
 perform public.audit_event(c,'Financial Year Changed','financial_year',y,jsonb_build_object('closed',close_year,'reason',reason_text));
end $$;
revoke all on function public.change_financial_year(uuid,uuid,boolean,integer,text)from public,anon;grant execute on function public.change_financial_year(uuid,uuid,boolean,integer,text)to authenticated;
commit;
