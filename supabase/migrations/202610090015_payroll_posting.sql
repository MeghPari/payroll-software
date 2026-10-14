begin;
create table public.payroll_account_mappings(company_id uuid not null references public.companies(id),code text not null check(code in('salaryExpense','employerExpense','netPayable','pf','esi','pt','tds','loan','advance','otherDeduction','employerOther')),account_id uuid not null,primary key(company_id,code),foreign key(company_id,account_id)references public.ledger_accounts(company_id,id));
create function public.save_payroll_accounts(c uuid,mappings jsonb)returns void language plpgsql security definer set search_path=''as $$declare item record;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if jsonb_typeof(mappings)<>'object'then raise exception 'Mappings required'using errcode='22023';end if;
 for item in select key,value from jsonb_each_text(mappings)loop
  if not exists(select 1 from public.ledger_accounts where company_id=c and id=item.value::uuid and status='Active')then raise exception 'Active company ledger required'using errcode='22023';end if;
  insert into public.payroll_account_mappings(company_id,code,account_id)values(c,item.key,item.value::uuid)on conflict(company_id,code)do update set account_id=excluded.account_id;
 end loop;perform public.audit_event(c,'Payroll Accounts Mapped','company',c);
end $$;
create function public.post_payroll_journal(c uuid,m date,expected_version integer)returns uuid language plpgsql security definer set search_path=''as $$declare run public.payroll_runs;lines_json jsonb:='[]';amount record;ledger uuid;rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into run from public.payroll_runs where company_id=c and month=m for update;
 if not found or run.status<>'Locked'then raise exception 'Locked payroll required'using errcode='23514';end if;if run.version<>expected_version then raise exception 'Payroll changed'using errcode='40001';end if;
 if exists(select 1 from public.journal_entries where company_id=c and source_type='payroll'and source_id=run.id)then raise exception 'Payroll already posted'using errcode='23514';end if;
 for amount in select 'salaryExpense'code,sum(gross_minor)total,true debit from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select 'employerExpense',sum(employer_minor),true from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select 'netPayable',sum(net_minor),false from public.payroll_run_employees where company_id=c and run_id=run.id
  union all select code,sum(amount_minor),false from public.payroll_run_components where company_id=c and run_id=run.id and kind in('deduction','employer')group by code
 loop
  if amount.total>0 then
   select account_id into ledger from public.payroll_account_mappings where company_id=c and code=amount.code;
   if not found then raise exception 'Configure payroll account mappings before posting'using errcode='23514';end if;
   lines_json:=lines_json||jsonb_build_array(jsonb_build_object('accountId',ledger,'debitMinor',case when amount.debit then amount.total else 0 end,'creditMinor',case when amount.debit then 0 else amount.total end));
  end if;
 end loop;
 rid:=public.create_journal(c,jsonb_build_object('voucherNumber','PAY-'||to_char(m,'YYYY-MM'),'date',(m+interval '1 month - 1 day')::date,'type','Journal','narration','Payroll accrual '||to_char(m,'YYYY-MM'),'lines',lines_json));
 update public.journal_entries set source_type='payroll',source_id=run.id where company_id=c and id=rid;perform public.post_journal(c,rid,1);perform public.audit_event(c,'Payroll Journal Posted','payroll_run',run.id,jsonb_build_object('journalId',rid));return rid;
end $$;
create function public.protect_posted_payroll()returns trigger language plpgsql security definer set search_path=''as $$begin
 if old.status='Locked'and new.status<>'Locked'and exists(select 1 from public.journal_entries where company_id=old.company_id and source_type='payroll'and source_id=old.id and status='Posted')then raise exception 'Posted payroll requires accounting reversal and a separate correction workflow'using errcode='23514';end if;return new;
end $$;
create trigger posted_payroll_guard before update on public.payroll_runs for each row execute function public.protect_posted_payroll();
alter table public.payroll_account_mappings enable row level security;revoke all on public.payroll_account_mappings from anon,authenticated;grant select on public.payroll_account_mappings to authenticated;
create policy payroll_mapping_read on public.payroll_account_mappings for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on function public.save_payroll_accounts(uuid,jsonb),public.post_payroll_journal(uuid,date,integer),public.protect_posted_payroll()from public,anon,authenticated;
grant execute on function public.save_payroll_accounts(uuid,jsonb),public.post_payroll_journal(uuid,date,integer)to authenticated;
commit;
