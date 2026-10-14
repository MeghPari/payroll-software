begin;
create table public.gst_credit_review_history(company_id uuid not null,invoice_id uuid not null,version integer not null,content jsonb not null,recorded_at timestamptz not null default now(),primary key(company_id,invoice_id,version),foreign key(company_id,invoice_id)references public.invoices(company_id,id));
insert into public.gst_credit_review_history select company_id,invoice_id,version,to_jsonb(r),now()from public.gst_credit_reviews r;
create function public.archive_gst_credit_review()returns trigger language plpgsql security definer set search_path=''as $$begin
 insert into public.gst_credit_review_history(company_id,invoice_id,version,content)values(new.company_id,new.invoice_id,new.version,to_jsonb(new));return new;
end $$;
create trigger gst_credit_history after insert or update on public.gst_credit_reviews for each row execute function public.archive_gst_credit_review();
create table public.gst_book_reviews(id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),month date not null check(extract(day from month)=1),review_reference text not null check(length(trim(review_reference))between 1 and 1000),content jsonb not null,created_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),unique(company_id,review_reference),unique(company_id,id));
alter table public.gst_credit_review_history enable row level security;alter table public.gst_book_reviews enable row level security;
create policy gst_credit_history_read on public.gst_credit_review_history for select to authenticated using(public.has_permission(company_id,'accounting.read'));
create policy gst_book_reviews_read on public.gst_book_reviews for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on public.gst_credit_review_history,public.gst_book_reviews from anon,authenticated;grant select on public.gst_credit_review_history,public.gst_book_reviews to authenticated;
create function public.capture_gst_book_review(c uuid,m date,reference_text text)returns uuid language plpgsql security definer set search_path=''as $$declare rid uuid:=gen_random_uuid();rows jsonb;company jsonb;begin
 perform public.require_permission(c,'accounting.write');perform public.require_permission(c,'compliance.write');perform 1 from public.companies where id=c for update;
 if m is null or extract(day from m)<>1 or m>date_trunc('month',now()at time zone 'Asia/Kolkata')::date or reference_text is null or length(trim(reference_text))not between 1 and 1000 then raise exception 'Valid month and reviewed archive reference required'using errcode='22023';end if;
 select jsonb_build_object('name',name,'profile',profile)into company from public.companies where id=c;
 with sources as(
  select i.id,i.invoice_number as number,i.kind,i.journal_id,1 as direction,i.taxable_minor,i.cgst_minor,i.sgst_minor,i.igst_minor,i.party_snapshot,to_jsonb(r)as credit_review,'invoice'::text as source from public.invoices i left join public.gst_credit_reviews r on r.company_id=i.company_id and r.invoice_id=i.id where i.company_id=c and i.journal_id is not null
  union all
  select n.id,n.number,i.kind,n.journal_id,case when n.kind='Credit'then -1 else 1 end,n.taxable_minor,n.cgst_minor,n.sgst_minor,n.igst_minor,i.party_snapshot,null,'note'from public.invoice_notes n join public.invoices i on i.company_id=n.company_id and i.id=n.invoice_id where n.company_id=c
 ),events as(
  select s.*,j.id as event_id,j.date,case when j.reversal_of is null then s.direction else -s.direction end as sign from sources s join public.journal_entries j on j.company_id=c and(j.id=s.journal_id or j.reversal_of=s.journal_id)where j.status='Posted'and j.date>=m and j.date<m+interval '1 month'
 )select coalesce(jsonb_agg(jsonb_build_object('id',event_id,'sourceId',id,'source',source,'number',number,'kind',kind,'date',date,'taxableMinor',sign*taxable_minor,'cgstMinor',sign*cgst_minor,'sgstMinor',sign*sgst_minor,'igstMinor',sign*igst_minor,'party',party_snapshot,'creditReviewAtCapture',credit_review)order by date,event_id),'[]')into rows from events;
 insert into public.gst_book_reviews(id,company_id,month,review_reference,content,created_by)values(rid,c,m,trim(reference_text),jsonb_build_object('company',company,'month',m,'rows',rows,'note','Immutable book review captured from posted journals. Eligibility is the saved review at capture time. This is not a submitted return or government acknowledgement.'),auth.uid());
 perform public.audit_event(c,'GST Book Review Archived','gst-review',rid,jsonb_build_object('month',m,'reference',trim(reference_text)));return rid;
end $$;
revoke all on function public.archive_gst_credit_review(),public.capture_gst_book_review(uuid,date,text)from public,anon,authenticated;grant execute on function public.capture_gst_book_review(uuid,date,text)to authenticated;
commit;
