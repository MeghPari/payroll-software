begin;
alter table public.journal_entries drop constraint journal_entries_status_check;
alter table public.journal_entries add constraint journal_entries_status_check check(status in('Draft','Posted','Cancelled'));
alter table public.financial_years add column version integer not null default 1;
create table public.accounting_periods(company_id uuid not null references public.companies(id),month date not null check(extract(day from month)=1),closed_at timestamptz,closed_by uuid references public.user_profiles(id),version integer not null default 1,primary key(company_id,month));
create function public.edit_draft_journal(c uuid,j uuid,expected_version integer,p jsonb,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare entry public.journal_entries;item jsonb;n integer:=0;old_lines jsonb;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into entry from public.journal_entries where company_id=c and id=j for update;
 if not found then raise exception 'Journal not found'using errcode='P0002';end if;
 if expected_version is null or entry.version<>expected_version then raise exception 'Journal changed; refresh'using errcode='40001';end if;
 if entry.status<>'Draft'or entry.source_type<>'manual'or length(trim(reason_text))not between 1 and 1000 then raise exception 'Manual draft and correction reason required'using errcode='23514';end if;
 if jsonb_typeof(p->'lines')<>'array'or jsonb_array_length(p->'lines')not between 2 and 100 or length(trim(coalesce(p->>'voucherNumber','')))not between 1 and 80 or length(trim(coalesce(p->>'narration','')))not between 1 and 1000 then raise exception 'Draft fields and lines required'using errcode='22023';end if;
 select jsonb_agg(to_jsonb(l)order by l.line_no)into old_lines from public.journal_lines l where company_id=c and entry_id=j;
 update public.journal_entries set voucher_number=p->>'voucherNumber',date=(p->>'date')::date,type=p->>'type',narration=p->>'narration',version=version+1 where company_id=c and id=j;
 delete from public.journal_lines where company_id=c and entry_id=j;
 for item in select value from jsonb_array_elements(p->'lines')loop n:=n+1;
 if not exists(select 1 from public.ledger_accounts where company_id=c and id=(item->>'accountId')::uuid and status='Active')then raise exception 'Active company ledger required'using errcode='23514';end if;
 if coalesce(item->>'debitMinor','0')!~'^[0-9]+$'or coalesce(item->>'creditMinor','0')!~'^[0-9]+$'then raise exception 'Integer paise required'using errcode='22023';end if;
 insert into public.journal_lines values(c,j,n,(item->>'accountId')::uuid,coalesce((item->>'debitMinor')::bigint,0),coalesce((item->>'creditMinor')::bigint,0));end loop;
 perform public.audit_event(c,'Journal Draft Corrected','journal',j,jsonb_build_object('previous',to_jsonb(entry),'previousLines',old_lines,'next',p,'reason',reason_text));
end $$;
create function public.cancel_draft_journal(c uuid,j uuid,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if expected_version is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Version and reason required'using errcode='22023';end if;
 update public.journal_entries set status='Cancelled',version=version+1 where company_id=c and id=j and status='Draft'and source_type='manual'and version=expected_version;
 if not found then raise exception 'Draft changed or is already posted'using errcode='40001';end if;
 perform public.audit_event(c,'Journal Draft Cancelled','journal',j,jsonb_build_object('reason',reason_text));
end $$;
create function public.change_accounting_period(c uuid,m date,close_period boolean,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare period public.accounting_periods;finish date:=(m+interval '1 month - 1 day')::date;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if extract(day from m)<>1 or length(trim(reason_text))not between 1 and 1000 or expected_version is null then raise exception 'Month, version and reason required'using errcode='22023';end if;
 select * into period from public.accounting_periods where company_id=c and month=m for update;
 if coalesce(period.version,0)<>expected_version then raise exception 'Accounting period changed; refresh'using errcode='40001';end if;
 if close_period then
 if finish>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Only completed accounting periods can close'using errcode='23514';end if;
 if not exists(select 1 from public.financial_years where company_id=c and start_date<=m and end_date>=finish and closed_at is null)then raise exception 'Open financial year required'using errcode='23514';end if;
 if exists(select 1 from public.journal_entries where company_id=c and status='Draft'and date between m and finish)or exists(select 1 from public.invoices where company_id=c and status='Draft'and date between m and finish)then raise exception 'Resolve draft documents before closing period'using errcode='23514';end if;
 if exists(select 1 from public.payroll_runs r where r.company_id=c and r.month=m and(r.status<>'Locked'or(exists(select 1 from public.payroll_run_employees e where e.company_id=c and e.run_id=r.id and(e.gross_minor>0 or e.employer_minor>0))and not exists(select 1 from public.journal_entries j where j.company_id=c and j.source_type='payroll'and j.source_id=r.id and j.status='Posted'))))then raise exception 'Complete payroll and its accrual before closing period'using errcode='23514';end if;
 end if;
 insert into public.accounting_periods(company_id,month,closed_at,closed_by)values(c,m,case when close_period then now()else null end,case when close_period then auth.uid()else null end)
 on conflict(company_id,month)do update set closed_at=excluded.closed_at,closed_by=excluded.closed_by,version=accounting_periods.version+1;
 perform public.audit_event(c,'Accounting Period Changed','accounting_period',null,jsonb_build_object('month',m,'closed',close_period,'reason',reason_text));
end $$;
create function public.change_financial_year(c uuid,y uuid,close_year boolean,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare year public.financial_years;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into year from public.financial_years where company_id=c and id=y for update;
 if not found then raise exception 'Financial year not found'using errcode='P0002';end if;if expected_version is null or year.version<>expected_version then raise exception 'Financial year changed; refresh'using errcode='40001';end if;
 if length(trim(reason_text))not between 1 and 1000 then raise exception 'Reason required'using errcode='22023';end if;
 if close_year and year.end_date>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Only completed financial years can close'using errcode='23514';end if;
 if close_year and exists(select 1 from public.journal_entries where company_id=c and status='Draft'and date between year.start_date and year.end_date)then raise exception 'Resolve draft journals before closing year'using errcode='23514';end if;
 update public.financial_years set closed_at=case when close_year then now()else null end,closed_by=case when close_year then auth.uid()else null end,version=version+1 where company_id=c and id=y;
 perform public.audit_event(c,'Financial Year Changed','financial_year',y,jsonb_build_object('closed',close_year,'reason',reason_text));
end $$;
create function public.protect_accounting_period()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.status='Posted'and old.status='Draft'and exists(select 1 from public.accounting_periods where company_id=new.company_id and month=date_trunc('month',new.date)::date and closed_at is not null)then raise exception 'Accounting period closed; reopen with an audited reason'using errcode='23514';end if;return new;
end $$;
create trigger accounting_period_guard before update on public.journal_entries for each row execute function public.protect_accounting_period();
alter table public.accounting_periods enable row level security;revoke all on public.accounting_periods from anon,authenticated;grant select on public.accounting_periods to authenticated;
create policy accounting_period_read on public.accounting_periods for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on function public.edit_draft_journal(uuid,uuid,integer,jsonb,text),public.cancel_draft_journal(uuid,uuid,integer,text),public.change_accounting_period(uuid,date,boolean,integer,text),public.change_financial_year(uuid,uuid,boolean,integer,text),public.protect_accounting_period()from public,anon,authenticated;
grant execute on function public.edit_draft_journal(uuid,uuid,integer,jsonb,text),public.cancel_draft_journal(uuid,uuid,integer,text),public.change_accounting_period(uuid,date,boolean,integer,text),public.change_financial_year(uuid,uuid,boolean,integer,text)to authenticated;
commit;
