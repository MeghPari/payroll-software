begin;
create table public.payroll_posting_details(
 company_id uuid not null,run_id uuid not null,journal_id uuid not null,mapping_snapshot jsonb not null,primary key(company_id,run_id),
 foreign key(company_id,run_id)references public.payroll_runs(company_id,id),foreign key(company_id,journal_id)references public.journal_entries(company_id,id)
);
alter function public.post_payroll_journal(uuid,date,integer)rename to post_payroll_journal_internal;
revoke all on function public.post_payroll_journal_internal(uuid,date,integer)from public,anon,authenticated;
create function public.post_payroll_journal(c uuid,m date,expected_version integer)returns uuid language plpgsql security definer set search_path=''as $$declare j uuid;r uuid;mappings jsonb;begin
 j:=public.post_payroll_journal_internal(c,m,expected_version);
 select id into r from public.payroll_runs where company_id=c and month=m;
 select jsonb_object_agg(code,account_id)into mappings from public.payroll_account_mappings where company_id=c;
 insert into public.payroll_posting_details values(c,r,j,mappings);return j;
end $$;
create table public.disbursement_batches(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,run_id uuid not null,run_version integer not null,bank_id uuid not null,payable_account_id uuid not null,
 status text not null default 'Prepared'check(status in('Prepared','Cancelled')),prepared_by uuid not null references public.user_profiles(id),prepared_at timestamptz not null default now(),
 unique(company_id,id),foreign key(company_id,run_id)references public.payroll_runs(company_id,id),foreign key(company_id,bank_id)references public.bank_accounts(company_id,id),foreign key(company_id,payable_account_id)references public.ledger_accounts(company_id,id)
);
create unique index active_disbursement_batch on public.disbursement_batches(company_id,run_id)where status='Prepared';
create table public.disbursement_items(
 company_id uuid not null,batch_id uuid not null,employee_id uuid not null,employee_code text not null,employee_name text not null,amount_minor bigint not null check(amount_minor between 1 and 9000000000000),bank_snapshot jsonb not null,
 primary key(company_id,batch_id,employee_id),foreign key(company_id,batch_id)references public.disbursement_batches(company_id,id),foreign key(company_id,employee_id)references public.employees(company_id,id)
);
create table public.disbursement_payments(
 company_id uuid not null,batch_id uuid not null,employee_id uuid not null,transaction_id uuid not null,primary key(company_id,transaction_id),
 foreign key(company_id,batch_id,employee_id)references public.disbursement_items(company_id,batch_id,employee_id),foreign key(company_id,transaction_id)references public.bank_transactions(company_id,id)
);
create function public.prepare_disbursement(c uuid,m date,b uuid)returns uuid language plpgsql security definer set search_path=''as $$
declare run public.payroll_runs;payable uuid;rid uuid;row record;bank public.employee_bank_details;n integer:=0;begin
 perform public.require_permission(c,'disbursements.write');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and month=m for update;
 if not found or run.status<>'Locked'then raise exception 'Locked payroll required'using errcode='23514';end if;
 if not exists(select 1 from public.bank_accounts where company_id=c and id=b and kind='Bank')then raise exception 'Company bank account required'using errcode='22023';end if;
 select(mapping_snapshot->>'netPayable')::uuid into payable from public.payroll_posting_details where company_id=c and run_id=run.id;
 if payable is null then raise exception 'Post payroll accrual before preparing payments'using errcode='23514';end if;
 if not exists(select 1 from public.ledger_accounts a join public.account_groups g on g.company_id=a.company_id and g.id=a.group_id where a.company_id=c and a.id=payable and a.status='Active'and g.type='Liability')then raise exception 'Payroll payable liability ledger required'using errcode='23514';end if;
 rid:=gen_random_uuid();insert into public.disbursement_batches(id,company_id,run_id,run_version,bank_id,payable_account_id,prepared_by)values(rid,c,run.id,run.version,b,payable,auth.uid());
 for row in select * from public.payroll_run_employees where company_id=c and run_id=run.id and net_minor>0 order by employee_id loop
  select * into bank from public.employee_bank_details where company_id=c and employee_id=row.employee_id;
  if bank.employee_id is null or bank.account_number=''or bank.ifsc_code=''or bank.account_holder_name=''or not exists(select 1 from public.employee_statutory_details s where s.company_id=c and s.employee_id=row.employee_id and s.bank_status='Verified')then raise exception 'Review and verify employee bank details before preparing payments'using errcode='23514';end if;
  insert into public.disbursement_items values(c,rid,row.employee_id,row.snapshot->>'employeeCode',row.snapshot->>'employeeName',row.net_minor,jsonb_build_object('accountHolderName',bank.account_holder_name,'accountNumber',bank.account_number,'ifscCode',bank.ifsc_code,'bankName',bank.bank_name));n:=n+1;
 end loop;
 if n=0 then raise exception 'No positive salary payments to prepare'using errcode='23514';end if;
 perform public.audit_event(c,'Payment Instructions Prepared','disbursement_batch',rid,jsonb_build_object('runId',run.id,'employees',n,'bankId',b));return rid;
end $$;
create function public.disbursement_batch(c uuid,m date,include_bank_details boolean default false)returns jsonb language plpgsql security definer set search_path=''as $$
declare batch public.disbursement_batches;items jsonb;payments jsonb;begin
 perform public.require_permission(c,'disbursements.write');
 select b.* into batch from public.disbursement_batches b join public.payroll_runs r on r.company_id=b.company_id and r.id=b.run_id where b.company_id=c and r.month=m and b.status='Prepared';
 if not found then return null;end if;
 select coalesce(jsonb_agg(jsonb_build_object('employeeId',i.employee_id,'employeeCode',i.employee_code,'employeeName',i.employee_name,'amountMinor',i.amount_minor,'paidMinor',coalesce((select sum(t.amount_minor)from public.disbursement_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.batch_id=batch.id and p.employee_id=i.employee_id and t.status='Confirmed'),0),'bank',case when include_bank_details then i.bank_snapshot else i.bank_snapshot||jsonb_build_object('accountNumber','••••'||right(i.bank_snapshot->>'accountNumber',4))end)order by i.employee_code),'[]'::jsonb)into items from public.disbursement_items i where i.company_id=c and i.batch_id=batch.id;
 select coalesce(jsonb_agg(jsonb_build_object('employeeId',p.employee_id,'transactionId',t.id,'amountMinor',t.amount_minor,'date',t.date,'reference',t.reference,'status',t.status)order by t.confirmed_at),'[]'::jsonb)into payments from public.disbursement_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.batch_id=batch.id;
 return jsonb_build_object('id',batch.id,'runId',batch.run_id,'runVersion',batch.run_version,'bankId',batch.bank_id,'preparedAt',batch.prepared_at,'items',items,'payments',payments);
end $$;
create function public.record_salary_payment(c uuid,batch_id uuid,e uuid,amount bigint,payment_date date,reference_text text,evidence text)returns uuid language plpgsql security definer set search_path=''as $$
declare batch public.disbursement_batches;item public.disbursement_items;run public.payroll_runs;bank public.bank_accounts;paid numeric;rid uuid;j uuid;begin
 perform public.require_permission(c,'disbursements.write');perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into batch from public.disbursement_batches b where b.company_id=c and b.id=batch_id and b.status='Prepared'for update;
 select * into item from public.disbursement_items i where i.company_id=c and i.batch_id=batch.id and i.employee_id=e;
 select * into run from public.payroll_runs where company_id=c and id=batch.run_id;
 if batch.id is null or item.employee_id is null or run.status<>'Locked'or run.version<>batch.run_version then raise exception 'Current locked payroll payment instructions required'using errcode='23514';end if;
 if amount<=0 or payment_date<(run.month+interval '1 month - 1 day')::date or payment_date>(now()at time zone 'Asia/Kolkata')::date or length(trim(reference_text))=0 or length(trim(evidence))=0 then raise exception 'Confirmed salary payment evidence required'using errcode='22023';end if;
 select * into bank from public.bank_accounts where company_id=c and id=batch.bank_id;
 select coalesce(sum(t.amount_minor),0)into paid from public.disbursement_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.batch_id=batch.id and p.employee_id=e and t.status='Confirmed';
 if paid+amount>item.amount_minor then raise exception 'Payment exceeds outstanding salary'using errcode='23514';end if;
 rid:=gen_random_uuid();j:=public.create_journal(c,jsonb_build_object('voucherNumber','SALPAY-'||rid,'date',payment_date,'type','Payment','narration','Confirmed salary payment '||reference_text,'lines',jsonb_build_array(jsonb_build_object('accountId',batch.payable_account_id,'debitMinor',amount,'creditMinor',0),jsonb_build_object('accountId',bank.account_id,'debitMinor',0,'creditMinor',amount))));
 update public.journal_entries set source_type='salary_payment',source_id=rid where company_id=c and id=j;perform public.post_journal(c,j,1);
 insert into public.bank_transactions(id,company_id,bank_id,date,direction,amount_minor,reference,evidence_note,journal_id,confirmed_by)values(rid,c,bank.id,payment_date,'Outflow',amount,trim(reference_text),trim(evidence),j,auth.uid());
 insert into public.disbursement_payments values(c,batch.id,e,rid);perform public.audit_event(c,'Salary Payment Recorded','employee',e,jsonb_build_object('batchId',batch.id,'transactionId',rid,'amountMinor',amount));return rid;
end $$;
create function public.cancel_disbursement(c uuid,b uuid,reason_text text)returns void language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'disbursements.write');perform 1 from public.companies where id=c for update;
 if length(trim(reason_text))=0 then raise exception 'Correction reason required'using errcode='22023';end if;
 if exists(select 1 from public.disbursement_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.batch_id=b and t.status='Confirmed')then raise exception 'Correct recorded payments before cancelling instructions'using errcode='23514';end if;
 update public.disbursement_batches set status='Cancelled'where company_id=c and id=b and status='Prepared';if not found then raise exception 'Prepared batch not found'using errcode='P0002';end if;
 perform public.audit_event(c,'Payment Instructions Cancelled','disbursement_batch',b,jsonb_build_object('reason',reason_text));
end $$;

-- Verification applies to the identifiers that were reviewed, not later replacements.
create function public.reset_bank_verification()returns trigger language plpgsql security definer set search_path=''as $$begin
 if tg_op='INSERT'or(new.account_holder_name,new.account_number,new.ifsc_code)is distinct from(old.account_holder_name,old.account_number,old.ifsc_code)then
  update public.employee_statutory_details set bank_status=case when new.account_number<>''and new.ifsc_code<>''then 'Pending Verification'else 'Not Provided'end where company_id=new.company_id and employee_id=new.employee_id;
 end if;return new;
end $$;
create trigger bank_verification_identifier_changed after insert or update on public.employee_bank_details for each row execute function public.reset_bank_verification();
create function public.reset_pan_verification()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.pan is distinct from old.pan then new.pan_status:=case when new.pan is null then 'Not Provided'else 'Pending Verification'end;end if;return new;
end $$;
create trigger pan_verification_identifier_changed before update on public.employee_statutory_details for each row execute function public.reset_pan_verification();
revoke all on function public.reset_bank_verification(),public.reset_pan_verification()from public,anon,authenticated;
do $$declare t text;begin foreach t in array array['payroll_posting_details','disbursement_batches','disbursement_items','disbursement_payments']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);
end loop;end $$;
-- Only permission-checked RPCs expose payment instructions and salary banking data.
revoke all on function public.post_payroll_journal(uuid,date,integer),public.prepare_disbursement(uuid,date,uuid),public.disbursement_batch(uuid,date,boolean),public.record_salary_payment(uuid,uuid,uuid,bigint,date,text,text),public.cancel_disbursement(uuid,uuid,text)from public,anon,authenticated;
grant execute on function public.post_payroll_journal(uuid,date,integer),public.prepare_disbursement(uuid,date,uuid),public.disbursement_batch(uuid,date,boolean),public.record_salary_payment(uuid,uuid,uuid,bigint,date,text,text),public.cancel_disbursement(uuid,uuid,text)to authenticated;
commit;
