begin;
create table public.business_parties(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),kind text not null check(kind in('Customer','Vendor')),
 name text not null check(length(trim(name))between 1 and 160),email text not null default '',phone text not null default '',gstin text not null default '',address text not null default '',state text not null default '',
 version integer not null default 1,created_at timestamptz not null default now(),unique(company_id,id),unique(company_id,kind,name)
);
create table public.bank_accounts(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),account_id uuid not null,kind text not null check(kind in('Bank','Cash')),
 name text not null check(length(trim(name))between 1 and 160),bank_name text not null default '',account_number text not null default '',ifsc text not null default '',
 unique(company_id,id),unique(company_id,account_id),foreign key(company_id,account_id)references public.ledger_accounts(company_id,id)
);
create table public.invoices(
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),kind text not null check(kind in('Sales','Purchase')),party_id uuid not null,
 invoice_number text not null check(length(trim(invoice_number))between 1 and 80),date date not null,due_date date not null check(due_date>=date),status text not null default 'Draft'check(status in('Draft','Posted','Cancelled')),
 tax_mode text not null check(tax_mode in('None','CGST_SGST','IGST')),review_reference text not null default '',taxable_minor bigint not null default 0 check(taxable_minor between 0 and 9000000000000),
 cgst_minor bigint not null default 0 check(cgst_minor>=0),sgst_minor bigint not null default 0 check(sgst_minor>=0),igst_minor bigint not null default 0 check(igst_minor>=0),total_minor bigint not null default 0 check(total_minor between 0 and 9000000000000),
 control_account_id uuid not null,base_account_id uuid not null,cgst_account_id uuid,sgst_account_id uuid,igst_account_id uuid,journal_id uuid,version integer not null default 1,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),
 party_snapshot jsonb not null,unique(company_id,id),unique(company_id,kind,invoice_number),foreign key(company_id,party_id)references public.business_parties(company_id,id),
 foreign key(company_id,control_account_id)references public.ledger_accounts(company_id,id),foreign key(company_id,base_account_id)references public.ledger_accounts(company_id,id),
 foreign key(company_id,cgst_account_id)references public.ledger_accounts(company_id,id),foreign key(company_id,sgst_account_id)references public.ledger_accounts(company_id,id),foreign key(company_id,igst_account_id)references public.ledger_accounts(company_id,id),foreign key(company_id,journal_id)references public.journal_entries(company_id,id)
);
create table public.invoice_items(
 company_id uuid not null,invoice_id uuid not null,line_no integer not null,description text not null check(length(trim(description))between 1 and 300),quantity numeric(12,3)not null check(quantity>0),
 unit_price_minor bigint not null check(unit_price_minor between 0 and 9000000000000),discount_minor bigint not null check(discount_minor>=0),tax_basis_points integer not null check(tax_basis_points between 0 and 10000),
 taxable_minor bigint not null check(taxable_minor between 0 and 9000000000000),tax_minor bigint not null check(tax_minor>=0),primary key(company_id,invoice_id,line_no),foreign key(company_id,invoice_id)references public.invoices(company_id,id)
);
create table public.bank_transactions(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,bank_id uuid not null,date date not null,direction text not null check(direction in('Inflow','Outflow')),amount_minor bigint not null check(amount_minor between 1 and 9000000000000),
 reference text not null check(length(trim(reference))between 1 and 160),evidence_note text not null check(length(trim(evidence_note))between 1 and 1000),journal_id uuid not null,status text not null default 'Confirmed'check(status in('Confirmed','Reversed')),
 confirmed_by uuid not null references public.user_profiles(id),confirmed_at timestamptz not null default now(),unique(company_id,id),unique(company_id,bank_id,reference),unique(company_id,journal_id),
 foreign key(company_id,bank_id)references public.bank_accounts(company_id,id),foreign key(company_id,journal_id)references public.journal_entries(company_id,id)
);
create table public.invoice_payments(company_id uuid not null,invoice_id uuid not null,transaction_id uuid not null,primary key(company_id,transaction_id),foreign key(company_id,invoice_id)references public.invoices(company_id,id),foreign key(company_id,transaction_id)references public.bank_transactions(company_id,id));

create function public.save_party(c uuid,p jsonb,e uuid default null,expected_version integer default null)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if e is null then
  insert into public.business_parties(company_id,kind,name,email,phone,gstin,address,state)values(c,p->>'kind',trim(p->>'name'),coalesce(p->>'email',''),coalesce(p->>'phone',''),coalesce(p->>'gstin',''),coalesce(p->>'address',''),coalesce(p->>'state',''))returning id into rid;
 else
  update public.business_parties set name=trim(p->>'name'),email=coalesce(p->>'email',''),phone=coalesce(p->>'phone',''),gstin=coalesce(p->>'gstin',''),address=coalesce(p->>'address',''),state=coalesce(p->>'state',''),version=version+1 where company_id=c and id=e and version=expected_version and kind=p->>'kind'returning id into rid;
  if rid is null then raise exception 'Party changed; refresh'using errcode='40001';end if;
 end if;
 perform public.audit_event(c,'Party Saved','party',rid);return rid;
end $$;
create function public.save_bank_account(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 if not exists(select 1 from public.ledger_accounts a join public.account_groups g on g.company_id=a.company_id and g.id=a.group_id where a.company_id=c and a.id=(p->>'accountId')::uuid and a.status='Active'and g.type='Asset')then raise exception 'Active asset ledger required'using errcode='22023';end if;
 insert into public.bank_accounts(company_id,account_id,kind,name,bank_name,account_number,ifsc)values(c,(p->>'accountId')::uuid,p->>'kind',p->>'name',coalesce(p->>'bankName',''),coalesce(p->>'accountNumber',''),coalesce(p->>'ifsc',''))returning id into rid;
 perform public.audit_event(c,'Bank Account Configured','bank_account',rid);return rid;
end $$;
create function public.create_invoice(c uuid,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$
declare rid uuid;party public.business_parties;existing public.invoices;item jsonb;qty numeric;unit_amount bigint;discount bigint;base bigint;tax bigint;cgst bigint;sgst bigint;igst bigint;n integer:=0;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into party from public.business_parties where company_id=c and id=(p->>'partyId')::uuid and kind=case when p->>'kind'='Sales'then 'Customer'else 'Vendor'end;
 if not found then raise exception 'Company party required'using errcode='22023';end if;
 if jsonb_typeof(p->'items')is distinct from 'array'or jsonb_array_length(p->'items')not between 1 and 100 then raise exception 'Invoice items required'using errcode='22023';end if;
 if nullif(p->>'id','')is not null then
  select * into existing from public.invoices where company_id=c and id=(p->>'id')::uuid for update;
  if existing.id is null then raise exception 'Invoice not found'using errcode='P0002';end if;
  if existing.version is distinct from(p->>'expectedVersion')::integer then raise exception 'Invoice changed; refresh'using errcode='40001';end if;
  if existing.status<>'Draft'or existing.kind<>p->>'kind'then raise exception 'Only matching draft invoices can be edited'using errcode='23514';end if;
  rid:=existing.id;delete from public.invoice_items where company_id=c and invoice_id=rid;
  update public.invoices set party_id=party.id,invoice_number=p->>'invoiceNumber',date=(p->>'date')::date,due_date=(p->>'dueDate')::date,tax_mode=p->>'taxMode',review_reference=coalesce(p->>'reviewReference',''),control_account_id=(p->>'controlAccountId')::uuid,base_account_id=(p->>'baseAccountId')::uuid,cgst_account_id=nullif(p->>'cgstAccountId','')::uuid,sgst_account_id=nullif(p->>'sgstAccountId','')::uuid,igst_account_id=nullif(p->>'igstAccountId','')::uuid,party_snapshot=jsonb_build_object('name',party.name,'gstin',party.gstin,'address',party.address,'state',party.state),taxable_minor=0,cgst_minor=0,sgst_minor=0,igst_minor=0,total_minor=0,version=version+1 where company_id=c and id=rid;
 else
 insert into public.invoices(company_id,kind,party_id,invoice_number,date,due_date,tax_mode,review_reference,control_account_id,base_account_id,cgst_account_id,sgst_account_id,igst_account_id,created_by,party_snapshot)
 values(c,p->>'kind',party.id,p->>'invoiceNumber',(p->>'date')::date,(p->>'dueDate')::date,p->>'taxMode',coalesce(p->>'reviewReference',''),(p->>'controlAccountId')::uuid,(p->>'baseAccountId')::uuid,nullif(p->>'cgstAccountId','')::uuid,nullif(p->>'sgstAccountId','')::uuid,nullif(p->>'igstAccountId','')::uuid,auth.uid(),jsonb_build_object('name',party.name,'gstin',party.gstin,'address',party.address,'state',party.state))returning id into rid;
 end if;
 for item in select value from jsonb_array_elements(p->'items')loop
  n:=n+1;
  if coalesce(item->>'unitPriceMinor','')!~'^[0-9]+$'or coalesce(item->>'discountMinor','0')!~'^[0-9]+$'or coalesce(item->>'taxBasisPoints','0')!~'^[0-9]+$'or coalesce(item->>'quantity','')!~'^[0-9]+(\.[0-9]{1,3})?$'then raise exception 'Exact quantity and integer paise required'using errcode='22023';end if;
  qty:=(item->>'quantity')::numeric;unit_amount:=(item->>'unitPriceMinor')::bigint;discount:=coalesce((item->>'discountMinor')::bigint,0);base:=round(qty*unit_amount)-discount;
  if base<0 then raise exception 'Discount exceeds line amount'using errcode='23514';end if;
  if p->>'taxMode'='None'and coalesce((item->>'taxBasisPoints')::integer,0)<>0 then raise exception 'Tax mode required'using errcode='23514';end if;
  tax:=round(base::numeric*coalesce((item->>'taxBasisPoints')::integer,0)/10000);cgst:=0;sgst:=0;igst:=0;
  if p->>'taxMode'='CGST_SGST'then cgst:=round(tax::numeric/2);sgst:=tax-cgst;elsif p->>'taxMode'='IGST'then igst:=tax;end if;
  insert into public.invoice_items values(c,rid,n,item->>'description',qty,unit_amount,discount,coalesce((item->>'taxBasisPoints')::integer,0),base,tax);
  update public.invoices set taxable_minor=taxable_minor+base,cgst_minor=cgst_minor+cgst,sgst_minor=sgst_minor+sgst,igst_minor=igst_minor+igst,total_minor=total_minor+base+tax where company_id=c and id=rid;
 end loop;
 perform public.audit_event(c,case when existing.id is null then 'Invoice Created'else 'Invoice Draft Updated'end,'invoice',rid);return rid;
end $$;

create function public.post_invoice(c uuid,i uuid,expected_version integer)returns uuid language plpgsql security definer set search_path=''as $$
declare invoice public.invoices;lines jsonb;j uuid;pair record;account_type text;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into invoice from public.invoices where company_id=c and id=i for update;
 if not found then raise exception 'Invoice not found'using errcode='P0002';end if;
 if invoice.version<>expected_version then raise exception 'Invoice changed; refresh'using errcode='40001';end if;
 if invoice.status<>'Draft'or invoice.total_minor<=0 then raise exception 'Positive draft invoice required'using errcode='23514';end if;
 if invoice.cgst_minor+invoice.sgst_minor+invoice.igst_minor>0 and length(trim(invoice.review_reference))=0 then raise exception 'Reviewed tax reference required'using errcode='23514';end if;
 for pair in select * from(values(invoice.control_account_id,case when invoice.kind='Sales'then 'Asset'else 'Liability'end),(invoice.base_account_id,case when invoice.kind='Sales'then 'Income'else 'Expense'end),(case when invoice.cgst_minor>0 then invoice.cgst_account_id end,case when invoice.kind='Sales'then 'Liability'else 'Asset'end),(case when invoice.sgst_minor>0 then invoice.sgst_account_id end,case when invoice.kind='Sales'then 'Liability'else 'Asset'end),(case when invoice.igst_minor>0 then invoice.igst_account_id end,case when invoice.kind='Sales'then 'Liability'else 'Asset'end))as x(account_id,required_type)loop
  if pair.account_id is null then continue;end if;
  select g.type into account_type from public.ledger_accounts a join public.account_groups g on g.company_id=a.company_id and g.id=a.group_id where a.company_id=c and a.id=pair.account_id and a.status='Active';
  if account_type is distinct from pair.required_type then raise exception 'Invoice ledger classification invalid'using errcode='22023';end if;
 end loop;
 lines:=jsonb_build_array(jsonb_build_object('accountId',invoice.control_account_id,'debitMinor',case when invoice.kind='Sales'then invoice.total_minor else 0 end,'creditMinor',case when invoice.kind='Purchase'then invoice.total_minor else 0 end),jsonb_build_object('accountId',invoice.base_account_id,'debitMinor',case when invoice.kind='Purchase'then invoice.taxable_minor else 0 end,'creditMinor',case when invoice.kind='Sales'then invoice.taxable_minor else 0 end));
 for pair in select * from(values(invoice.cgst_account_id,invoice.cgst_minor),(invoice.sgst_account_id,invoice.sgst_minor),(invoice.igst_account_id,invoice.igst_minor))as x(account_id,amount)loop
  if pair.amount>0 then
   if pair.account_id is null then raise exception 'Tax ledger required'using errcode='23514';end if;
   lines:=lines||jsonb_build_array(jsonb_build_object('accountId',pair.account_id,'debitMinor',case when invoice.kind='Purchase'then pair.amount else 0 end,'creditMinor',case when invoice.kind='Sales'then pair.amount else 0 end));
  end if;
 end loop;
 j:=public.create_journal(c,jsonb_build_object('voucherNumber',invoice.kind||'-'||invoice.invoice_number,'date',invoice.date,'type','Journal','narration',invoice.kind||' invoice '||invoice.invoice_number,'lines',lines));
 update public.journal_entries set source_type=case when invoice.kind='Sales'then 'sales_invoice'else 'purchase_invoice'end,source_id=i where company_id=c and id=j;
 perform public.post_journal(c,j,1);update public.invoices set status='Posted',journal_id=j,version=version+1 where company_id=c and id=i;
 perform public.audit_event(c,'Invoice Posted','invoice',i,jsonb_build_object('journalId',j));return j;
end $$;

create function public.record_invoice_payment(c uuid,i uuid,b uuid,amount bigint,payment_date date,reference_text text,evidence text)returns uuid language plpgsql security definer set search_path=''as $$
declare invoice public.invoices;bank public.bank_accounts;paid numeric;j uuid;rid uuid;lines jsonb;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into invoice from public.invoices where company_id=c and id=i for update;select * into bank from public.bank_accounts where company_id=c and id=b;
 if invoice.id is null or invoice.status<>'Posted'or bank.id is null or amount<=0 or payment_date<invoice.date or payment_date>(now()at time zone 'Asia/Kolkata')::date or length(trim(reference_text))=0 or length(trim(evidence))=0 then raise exception 'Posted invoice and confirmed payment evidence required'using errcode='22023';end if;
 if bank.account_id=invoice.control_account_id then raise exception 'Funding and invoice control ledgers must differ'using errcode='22023';end if;
 select coalesce(sum(t.amount_minor),0)into paid from public.invoice_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.invoice_id=i and t.status='Confirmed';
 if paid+amount>invoice.total_minor then raise exception 'Payment exceeds outstanding amount'using errcode='23514';end if;
 lines:=jsonb_build_array(jsonb_build_object('accountId',bank.account_id,'debitMinor',case when invoice.kind='Sales'then amount else 0 end,'creditMinor',case when invoice.kind='Purchase'then amount else 0 end),jsonb_build_object('accountId',invoice.control_account_id,'debitMinor',case when invoice.kind='Purchase'then amount else 0 end,'creditMinor',case when invoice.kind='Sales'then amount else 0 end));
 rid:=gen_random_uuid();j:=public.create_journal(c,jsonb_build_object('voucherNumber','PAY-'||rid,'date',payment_date,'type',case when invoice.kind='Sales'then 'Receipt'else 'Payment'end,'narration','Confirmed invoice payment '||reference_text,'lines',lines));
 update public.journal_entries set source_type='invoice_payment',source_id=rid where company_id=c and id=j;perform public.post_journal(c,j,1);
 insert into public.bank_transactions(id,company_id,bank_id,date,direction,amount_minor,reference,evidence_note,journal_id,confirmed_by)values(rid,c,b,payment_date,case when invoice.kind='Sales'then 'Inflow'else 'Outflow'end,amount,trim(reference_text),trim(evidence),j,auth.uid());
 insert into public.invoice_payments values(c,i,rid);perform public.audit_event(c,'Invoice Payment Recorded','invoice',i,jsonb_build_object('transactionId',rid,'amountMinor',amount));return rid;
end $$;

-- Source documents must be corrected through their own audited workflow.
alter function public.reverse_journal(uuid,uuid,date,text)rename to reverse_journal_internal;
revoke all on function public.reverse_journal_internal(uuid,uuid,date,text)from public,anon,authenticated;
create function public.reverse_journal(c uuid,j uuid,reversal_date date,reason_text text)returns uuid language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'accounting.write');
 if exists(select 1 from public.journal_entries e where e.company_id=c and e.id=j and(e.source_type<>'manual'or exists(select 1 from public.journal_entries original where original.company_id=c and original.id=e.reversal_of and original.source_type<>'manual')))then raise exception 'Use the source document correction workflow'using errcode='23514';end if;
 return public.reverse_journal_internal(c,j,reversal_date,reason_text);
end $$;
create function public.reverse_bank_transaction(c uuid,t uuid,reversal_date date,reason_text text)returns uuid language plpgsql security definer set search_path=''as $$declare transaction public.bank_transactions;rid uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into transaction from public.bank_transactions where company_id=c and id=t for update;
 if not found or transaction.status<>'Confirmed'or length(trim(reason_text))=0 then raise exception 'Confirmed transaction and correction reason required'using errcode='23514';end if;
 if reversal_date<transaction.date or reversal_date>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Valid reversal date required'using errcode='22023';end if;
 rid:=public.reverse_journal_internal(c,transaction.journal_id,reversal_date,reason_text);
 update public.bank_transactions set status='Reversed'where company_id=c and id=t;
 perform public.audit_event(c,'Bank Entry Reversed','bank_transaction',t,jsonb_build_object('journalId',rid,'reason',reason_text));return rid;
end $$;
create function public.cancel_invoice(c uuid,i uuid,expected_version integer,reversal_date date,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare invoice public.invoices;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into invoice from public.invoices where company_id=c and id=i for update;
 if not found then raise exception 'Invoice not found'using errcode='P0002';end if;
 if invoice.version<>expected_version then raise exception 'Invoice changed; refresh'using errcode='40001';end if;
 if invoice.status='Cancelled'or length(trim(reason_text))=0 then raise exception 'Active invoice and correction reason required'using errcode='23514';end if;
 if exists(select 1 from public.invoice_payments p join public.bank_transactions t on t.company_id=p.company_id and t.id=p.transaction_id where p.company_id=c and p.invoice_id=i and t.status='Confirmed')then raise exception 'Reverse payment entries before cancelling invoice'using errcode='23514';end if;
 if invoice.status='Posted'then
  if reversal_date<invoice.date or reversal_date>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Valid reversal date required'using errcode='22023';end if;
  perform public.reverse_journal_internal(c,invoice.journal_id,reversal_date,reason_text);
 end if;
 update public.invoices set status='Cancelled',version=version+1 where company_id=c and id=i;
 perform public.audit_event(c,'Invoice Cancelled In Books','invoice',i,jsonb_build_object('reason',reason_text));
end $$;

do $$declare t text;begin foreach t in array array['business_parties','bank_accounts','invoices','invoice_items','bank_transactions','invoice_payments']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);execute format('create policy finance_read on public.%I for select to authenticated using(public.has_permission(company_id,''accounting.read''))',t);
end loop;end $$;
revoke all on function public.save_party(uuid,jsonb,uuid,integer),public.save_bank_account(uuid,jsonb),public.create_invoice(uuid,jsonb),public.post_invoice(uuid,uuid,integer),public.record_invoice_payment(uuid,uuid,uuid,bigint,date,text,text)from public,anon,authenticated;
grant execute on function public.save_party(uuid,jsonb,uuid,integer),public.save_bank_account(uuid,jsonb),public.create_invoice(uuid,jsonb),public.post_invoice(uuid,uuid,integer),public.record_invoice_payment(uuid,uuid,uuid,bigint,date,text,text)to authenticated;
revoke all on function public.reverse_journal(uuid,uuid,date,text),public.reverse_bank_transaction(uuid,uuid,date,text),public.cancel_invoice(uuid,uuid,integer,date,text)from public,anon,authenticated;
grant execute on function public.reverse_journal(uuid,uuid,date,text),public.reverse_bank_transaction(uuid,uuid,date,text),public.cancel_invoice(uuid,uuid,integer,date,text)to authenticated;
commit;
