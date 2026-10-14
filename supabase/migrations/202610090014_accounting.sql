begin;
create table public.account_groups(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),name text not null,type text not null check(type in('Asset','Liability','Income','Expense','Equity')),parent_id uuid,unique(company_id,id),unique(company_id,name),foreign key(company_id,parent_id)references public.account_groups(company_id,id));
create table public.ledger_accounts(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),group_id uuid not null,name text not null,code text not null,status text not null default 'Active'check(status in('Active','Inactive')),version integer not null default 1,unique(company_id,id),unique(company_id,code),unique(company_id,name),foreign key(company_id,group_id)references public.account_groups(company_id,id));
create table public.financial_years(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),start_date date not null,end_date date not null check(end_date>=start_date),closed_at timestamptz,closed_by uuid references public.user_profiles(id),unique(company_id,start_date));
create table public.journal_entries(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),voucher_number text not null,date date not null,type text not null check(type in('Journal','Payment','Receipt','Contra')),narration text not null,status text not null default 'Draft'check(status in('Draft','Posted')),version integer not null default 1,source_type text not null default 'manual',source_id uuid,reversal_of uuid,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),posted_by uuid references public.user_profiles(id),posted_at timestamptz,unique(company_id,id),unique(company_id,voucher_number),unique(company_id,source_type,source_id),unique(company_id,reversal_of),foreign key(company_id,reversal_of)references public.journal_entries(company_id,id));
create table public.journal_lines(company_id uuid not null,entry_id uuid not null,line_no integer not null,account_id uuid not null,debit_minor bigint not null default 0,credit_minor bigint not null default 0,check(debit_minor between 0 and 9000000000000 and credit_minor between 0 and 9000000000000 and((debit_minor>0 and credit_minor=0)or(credit_minor>0 and debit_minor=0))),primary key(company_id,entry_id,line_no),foreign key(company_id,entry_id)references public.journal_entries(company_id,id),foreign key(company_id,account_id)references public.ledger_accounts(company_id,id));
create function public.save_account(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if p->>'kind'='group'then insert into public.account_groups(company_id,name,type,parent_id)values(c,p->>'name',p->>'type',nullif(p->>'parentId','')::uuid)returning id into rid;
 elsif p->>'kind'='ledger'then insert into public.ledger_accounts(company_id,group_id,name,code)values(c,(p->>'groupId')::uuid,p->>'name',p->>'code')returning id into rid;
 else raise exception 'Invalid account kind'using errcode='22023';end if;
 perform public.audit_event(c,'Account Created','account',rid);return rid;
end $$;
create function public.configure_financial_year(c uuid,start_value date,end_value date)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if end_value<start_value or exists(select 1 from public.financial_years where company_id=c and financial_years.start_date<=end_value and financial_years.end_date>=start_value)then raise exception 'Overlapping or invalid financial year'using errcode='23514';end if;
 insert into public.financial_years(company_id,start_date,end_date)values(c,start_value,end_value)returning id into rid;perform public.audit_event(c,'Financial Year Configured','financial_year',rid);return rid;
end $$;
create function public.create_journal(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;item jsonb;n integer:=0;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if length(trim(coalesce(p->>'narration','')))=0 or jsonb_typeof(p->'lines')<>'array'or jsonb_array_length(p->'lines')not between 2 and 100 then raise exception 'Narration and lines required'using errcode='22023';end if;
 insert into public.journal_entries(company_id,voucher_number,date,type,narration,created_by)values(c,p->>'voucherNumber',(p->>'date')::date,p->>'type',p->>'narration',auth.uid())returning id into rid;
 for item in select value from jsonb_array_elements(p->'lines')loop
  n:=n+1;
  if not exists(select 1 from public.ledger_accounts where company_id=c and id=(item->>'accountId')::uuid and status='Active')then raise exception 'Active company ledger required'using errcode='22023';end if;
  if coalesce(item->>'debitMinor','0')!~'^[0-9]+$'or coalesce(item->>'creditMinor','0')!~'^[0-9]+$'then raise exception 'Integer paise required'using errcode='22023';end if;
  insert into public.journal_lines(company_id,entry_id,line_no,account_id,debit_minor,credit_minor)values(c,rid,n,(item->>'accountId')::uuid,coalesce((item->>'debitMinor')::bigint,0),coalesce((item->>'creditMinor')::bigint,0));
 end loop;
 perform public.audit_event(c,'Journal Created','journal',rid);return rid;
end $$;
create function public.post_journal(c uuid,j uuid,expected_version integer)returns void language plpgsql security definer set search_path=''as $$declare entry public.journal_entries;debits numeric;credits numeric;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into entry from public.journal_entries where company_id=c and id=j for update;
 if not found then raise exception 'Journal not found'using errcode='P0002';end if;if entry.version<>expected_version then raise exception 'Journal changed'using errcode='40001';end if;
 if entry.status<>'Draft'then raise exception 'Already posted'using errcode='23514';end if;
 if not exists(select 1 from public.financial_years where company_id=c and start_date<=entry.date and end_date>=entry.date and closed_at is null)then raise exception 'Configure an open financial year covering this date'using errcode='23514';end if;
 select sum(debit_minor),sum(credit_minor)into debits,credits from public.journal_lines where company_id=c and entry_id=j;
 if debits is null or debits=0 or debits<>credits then raise exception 'Journal must balance before posting'using errcode='23514';end if;
 update public.journal_entries set status='Posted',version=version+1,posted_by=auth.uid(),posted_at=now()where company_id=c and id=j;
 perform public.audit_event(c,'Journal Posted','journal',j,jsonb_build_object('debitMinor',debits,'creditMinor',credits));
end $$;
create function public.reverse_journal(c uuid,j uuid,reversal_date date,reason_text text)returns uuid language plpgsql security definer set search_path=''as $$declare entry public.journal_entries;rid uuid;rows_json jsonb;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into entry from public.journal_entries where company_id=c and id=j for update;
 if not found or entry.status<>'Posted'or length(trim(reason_text))=0 then raise exception 'Posted entry and reason required'using errcode='23514';end if;
 if exists(select 1 from public.journal_entries where company_id=c and reversal_of=j)then raise exception 'Already reversed'using errcode='23514';end if;
 select jsonb_agg(jsonb_build_object('accountId',account_id,'debitMinor',credit_minor,'creditMinor',debit_minor)order by line_no)into rows_json from public.journal_lines where company_id=c and entry_id=j;
 rid:=public.create_journal(c,jsonb_build_object('voucherNumber','REV-'||gen_random_uuid(),'date',reversal_date,'type','Journal','narration',reason_text,'lines',rows_json));
 update public.journal_entries set reversal_of=j where company_id=c and id=rid;perform public.post_journal(c,rid,1);perform public.audit_event(c,'Journal Reversed','journal',j,jsonb_build_object('reversalId',rid,'reason',reason_text));return rid;
end $$;
create function public.account_balances(c uuid)returns table(account_id uuid,debit_minor numeric,credit_minor numeric,balance_minor numeric)language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'accounting.read');return query select a.id,coalesce(sum(l.debit_minor),0),coalesce(sum(l.credit_minor),0),coalesce(sum(l.debit_minor-l.credit_minor),0)from public.ledger_accounts a left join(public.journal_lines l join public.journal_entries j on j.company_id=l.company_id and j.id=l.entry_id and j.status='Posted')on l.company_id=a.company_id and l.account_id=a.id where a.company_id=c group by a.id;
end $$;
do $$declare t text;begin foreach t in array array['account_groups','ledger_accounts','financial_years','journal_entries','journal_lines']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('create policy accounting_read on public.%I for select to authenticated using(public.has_permission(company_id,''accounting.read''))',t);end loop;end $$;
revoke all on function public.save_account(uuid,jsonb),public.configure_financial_year(uuid,date,date),public.create_journal(uuid,jsonb),public.post_journal(uuid,uuid,integer),public.reverse_journal(uuid,uuid,date,text),public.account_balances(uuid)from public,anon,authenticated;
grant execute on function public.save_account(uuid,jsonb),public.configure_financial_year(uuid,date,date),public.create_journal(uuid,jsonb),public.post_journal(uuid,uuid,integer),public.reverse_journal(uuid,uuid,date,text),public.account_balances(uuid)to authenticated;
commit;
