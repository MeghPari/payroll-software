begin;
alter table public.invoices add column adjustment_minor bigint not null default 0;
create table public.invoice_notes(
 id uuid primary key default gen_random_uuid(),company_id uuid not null,invoice_id uuid not null,
 kind text not null check(kind in('Credit','Debit')),number text not null check(length(trim(number))between 1 and 80),date date not null,
 taxable_minor bigint not null check(taxable_minor>=0),cgst_minor bigint not null check(cgst_minor>=0),sgst_minor bigint not null check(sgst_minor>=0),igst_minor bigint not null check(igst_minor>=0),
 total_minor bigint not null check(total_minor>0 and total_minor=taxable_minor+cgst_minor+sgst_minor+igst_minor and total_minor<=9000000000000),
 reason text not null check(length(trim(reason))between 1 and 1000),review_reference text not null check(length(trim(review_reference))between 1 and 1000),
 status text not null default 'Posted'check(status in('Posted','Reversed')),version integer not null default 1,journal_id uuid not null,
 created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),
 unique(company_id,id),unique(company_id,number),foreign key(company_id,invoice_id)references public.invoices(company_id,id),foreign key(company_id,journal_id)references public.journal_entries(company_id,id)
);
alter table public.invoice_notes enable row level security;
create policy invoice_notes_read on public.invoice_notes for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on public.invoice_notes from anon,authenticated;grant select on public.invoice_notes to authenticated;
create function public.post_invoice_note(c uuid,i uuid,expected_version integer,p jsonb)returns uuid language plpgsql security definer set search_path=''as $$
declare invoice public.invoices;n uuid:=gen_random_uuid();j uuid;direction integer;base bigint;cg bigint;sg bigint;ig bigint;total bigint;paid numeric;amounts record;lines jsonb;debit boolean;remaining record;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into invoice from public.invoices where company_id=c and id=i for update;
 if not found then raise exception 'Invoice not found'using errcode='P0002';end if;
 if expected_version is null or invoice.version<>expected_version then raise exception 'Invoice changed; refresh'using errcode='40001';end if;
 if invoice.status<>'Posted'or p->>'kind'not in('Credit','Debit')or p->>'kind'is null or(p->>'date')::date<invoice.date or(p->>'date')::date>(now()at time zone 'Asia/Kolkata')::date then raise exception 'Posted invoice and valid note date required'using errcode='22023';end if;
 base:=(p->>'taxableMinor')::bigint;cg:=(p->>'cgstMinor')::bigint;sg:=(p->>'sgstMinor')::bigint;ig:=(p->>'igstMinor')::bigint;
 if base is null or cg is null or sg is null or ig is null or least(base,cg,sg,ig)<0 or greatest(base,cg,sg,ig)>9000000000000 then raise exception 'Valid reviewed note amounts required'using errcode='22023';end if;
 total:=base+cg+sg+ig;direction:=case when p->>'kind'='Credit'then -1 else 1 end;
 if total<=0 or total>9000000000000 or length(trim(coalesce(p->>'number','')))not between 1 and 80 or length(trim(coalesce(p->>'reason','')))not between 1 and 1000 or length(trim(coalesce(p->>'reviewReference','')))not between 1 and 1000 then raise exception 'Note number, amounts, reason and review required'using errcode='22023';end if;
 if(invoice.tax_mode='None'and cg+sg+ig<>0)or(invoice.tax_mode='IGST'and cg+sg<>0)or(invoice.tax_mode='CGST_SGST'and ig<>0)then raise exception 'Note tax mode must match invoice'using errcode='23514';end if;
 select invoice.taxable_minor+coalesce(sum(case when kind='Credit'then -taxable_minor else taxable_minor end),0)as base,invoice.cgst_minor+coalesce(sum(case when kind='Credit'then -cgst_minor else cgst_minor end),0)as cg,invoice.sgst_minor+coalesce(sum(case when kind='Credit'then -sgst_minor else sgst_minor end),0)as sg,invoice.igst_minor+coalesce(sum(case when kind='Credit'then -igst_minor else igst_minor end),0)as ig into remaining from public.invoice_notes where company_id=c and invoice_id=i and status='Posted';
 if direction=-1 and(base>remaining.base or cg>remaining.cg or sg>remaining.sg or ig>remaining.ig)then raise exception 'Credit exceeds remaining invoice components'using errcode='23514';end if;
 if invoice.kind='Purchase'and exists(select 1 from public.gst_credit_reviews where company_id=c and invoice_id=i and(cgst_minor>remaining.cg+direction*cg or sgst_minor>remaining.sg+direction*sg or igst_minor>remaining.ig+direction*ig))then raise exception 'Correct purchase credit eligibility before posting note'using errcode='23514';end if;
 select coalesce(sum(t.amount_minor),0)into paid from public.invoice_payments x join public.bank_transactions t on t.company_id=x.company_id and t.id=x.transaction_id where x.company_id=c and x.invoice_id=i and t.status='Confirmed';
 if invoice.total_minor+invoice.adjustment_minor+direction*total<paid or invoice.total_minor+invoice.adjustment_minor+direction*total>9000000000000 then raise exception 'Note would overpay or exceed invoice amount limit'using errcode='23514';end if;
 debit:=(invoice.kind='Sales')=(direction=1);
 lines:=jsonb_build_array(jsonb_build_object('accountId',invoice.control_account_id,'debitMinor',case when debit then total else 0 end,'creditMinor',case when debit then 0 else total end));
 for amounts in select * from(values(invoice.base_account_id,base),(invoice.cgst_account_id,cg),(invoice.sgst_account_id,sg),(invoice.igst_account_id,ig))as pair(account_id,amount)loop
  if amounts.amount>0 then if amounts.account_id is null then raise exception 'Tax ledger required'using errcode='23514';end if;lines:=lines||jsonb_build_array(jsonb_build_object('accountId',amounts.account_id,'debitMinor',case when debit then 0 else amounts.amount end,'creditMinor',case when debit then amounts.amount else 0 end));end if;
 end loop;
 j:=public.create_journal(c,jsonb_build_object('voucherNumber','NOTE-'||(p->>'number'),'date',p->>'date','type','Journal','narration',(p->>'kind')||' note for '||invoice.invoice_number||': '||(p->>'reason'),'lines',lines));
 update public.journal_entries set source_type='invoice_note',source_id=n where company_id=c and id=j;perform public.post_journal(c,j,1);
 insert into public.invoice_notes(id,company_id,invoice_id,kind,number,date,taxable_minor,cgst_minor,sgst_minor,igst_minor,total_minor,reason,review_reference,journal_id,created_by)values(n,c,i,p->>'kind',trim(p->>'number'),(p->>'date')::date,base,cg,sg,ig,total,trim(p->>'reason'),trim(p->>'reviewReference'),j,auth.uid());
 update public.invoices set adjustment_minor=adjustment_minor+direction*total,version=version+1 where company_id=c and id=i;
 perform public.audit_event(c,'Invoice Note Posted','invoice-note',n,jsonb_build_object('invoiceId',i,'journalId',j));return n;
end $$;
create function public.reverse_invoice_note(c uuid,n uuid,expected_version integer,reversal_date date,reason_text text)returns uuid language plpgsql security definer set search_path=''as $$declare note public.invoice_notes;invoice public.invoices;paid numeric;direction integer;remaining record;j uuid;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into note from public.invoice_notes where company_id=c and id=n for update;if not found then raise exception 'Note not found'using errcode='P0002';end if;
 if expected_version is null or note.version<>expected_version then raise exception 'Note changed; refresh'using errcode='40001';end if;
 if note.status<>'Posted'or reversal_date is null or reversal_date<note.date or reversal_date>(now()at time zone 'Asia/Kolkata')::date or reason_text is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Posted note, date and correction reason required'using errcode='22023';end if;
 select * into invoice from public.invoices where company_id=c and id=note.invoice_id for update;direction:=case when note.kind='Credit'then 1 else -1 end;
 select coalesce(sum(t.amount_minor),0)into paid from public.invoice_payments x join public.bank_transactions t on t.company_id=x.company_id and t.id=x.transaction_id where x.company_id=c and x.invoice_id=invoice.id and t.status='Confirmed';
 if invoice.total_minor+invoice.adjustment_minor+direction*note.total_minor<paid or invoice.total_minor+invoice.adjustment_minor+direction*note.total_minor>9000000000000 then raise exception 'Correct payment entries before reversing debit note'using errcode='23514';end if;
 select invoice.cgst_minor+coalesce(sum(case when kind='Credit'then -cgst_minor else cgst_minor end),0)as cg,invoice.sgst_minor+coalesce(sum(case when kind='Credit'then -sgst_minor else sgst_minor end),0)as sg,invoice.igst_minor+coalesce(sum(case when kind='Credit'then -igst_minor else igst_minor end),0)as ig into remaining from public.invoice_notes where company_id=c and invoice_id=invoice.id and status='Posted'and id<>n;
 if exists(select 1 from public.gst_credit_reviews where company_id=c and invoice_id=invoice.id and(cgst_minor>remaining.cg or sgst_minor>remaining.sg or igst_minor>remaining.ig))then raise exception 'Correct purchase credit eligibility before posting note'using errcode='23514';end if;
 if exists(select 1 from public.invoice_notes where company_id=c and invoice_id=invoice.id and status='Posted'and id<>n having invoice.taxable_minor+coalesce(sum(case when kind='Credit'then -taxable_minor else taxable_minor end),0)<0 or invoice.cgst_minor+coalesce(sum(case when kind='Credit'then -cgst_minor else cgst_minor end),0)<0 or invoice.sgst_minor+coalesce(sum(case when kind='Credit'then -sgst_minor else sgst_minor end),0)<0 or invoice.igst_minor+coalesce(sum(case when kind='Credit'then -igst_minor else igst_minor end),0)<0)then raise exception 'Reverse dependent credit notes first'using errcode='23514';end if;
 j:=public.reverse_journal_internal(c,note.journal_id,reversal_date,reason_text);
 update public.invoice_notes set status='Reversed',version=version+1 where company_id=c and id=n;
 update public.invoices set adjustment_minor=adjustment_minor+direction*note.total_minor,version=version+1 where company_id=c and id=invoice.id;
 perform public.audit_event(c,'Invoice Note Reversed','invoice-note',n,jsonb_build_object('reason',reason_text));return j;
end $$;
-- Preserve the source payment workflow while accounting for reviewed notes.
do $$declare definition text;begin
 select pg_get_functiondef('public.record_invoice_payment(uuid,uuid,uuid,bigint,date,text,text)'::regprocedure)into definition;
 if position('paid+amount>invoice.total_minor' in definition)=0 then raise exception 'Payment migration anchor missing';end if;
 execute replace(definition,'paid+amount>invoice.total_minor','paid+amount>invoice.total_minor+invoice.adjustment_minor');
 select pg_get_functiondef('public.cancel_invoice(uuid,uuid,integer,date,text)'::regprocedure)into definition;
 if position('if invoice.status=' in definition)=0 then raise exception 'Invoice cancellation anchor missing';end if;
 definition:=replace(definition,'if invoice.status=',E'if exists(select 1 from public.invoice_notes where company_id=c and invoice_id=i and status=''Posted'')then raise exception ''Reverse invoice notes before cancelling invoice''using errcode=''23514'';end if;\n if invoice.status=');execute definition;
 select pg_get_functiondef('public.review_gst_credit(uuid,uuid,integer,jsonb)'::regprocedure)into definition;
 if position('select * into review from' in definition)=0 then raise exception 'GST review anchor missing';end if;
 definition:=replace(definition,'select * into review from',E'select inv.cgst_minor+coalesce(sum(case when kind=''Credit''then -cgst_minor else cgst_minor end),0),inv.sgst_minor+coalesce(sum(case when kind=''Credit''then -sgst_minor else sgst_minor end),0),inv.igst_minor+coalesce(sum(case when kind=''Credit''then -igst_minor else igst_minor end),0)into inv.cgst_minor,inv.sgst_minor,inv.igst_minor from public.invoice_notes where company_id=c and invoice_id=i and status=''Posted'';\n select * into review from');execute definition;
end $$;
revoke all on function public.post_invoice_note(uuid,uuid,integer,jsonb),public.reverse_invoice_note(uuid,uuid,integer,date,text)from public,anon,authenticated;
grant execute on function public.post_invoice_note(uuid,uuid,integer,jsonb),public.reverse_invoice_note(uuid,uuid,integer,date,text)to authenticated;
commit;
