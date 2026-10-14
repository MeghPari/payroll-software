begin;
create table public.gst_credit_reviews(company_id uuid not null,invoice_id uuid not null,cgst_minor bigint not null check(cgst_minor>=0),sgst_minor bigint not null check(sgst_minor>=0),igst_minor bigint not null check(igst_minor>=0),review_reference text not null check(length(trim(review_reference))between 1 and 1000),reviewed_by uuid not null references public.user_profiles(id),reviewed_at timestamptz not null default now(),version integer not null default 1,primary key(company_id,invoice_id),foreign key(company_id,invoice_id)references public.invoices(company_id,id));
create function public.review_gst_credit(c uuid,i uuid,expected_version integer,p jsonb)returns void language plpgsql security definer set search_path=''as $$declare inv public.invoices;review public.gst_credit_reviews;cg bigint;sg bigint;ig bigint;begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;select * into inv from public.invoices where company_id=c and id=i for update;
 if not found or inv.status<>'Posted'or inv.kind<>'Purchase'then raise exception 'Posted purchase invoice required'using errcode='23514';end if;
 select * into review from public.gst_credit_reviews where company_id=c and invoice_id=i;
 if expected_version is null or coalesce(review.version,0)<>expected_version then raise exception 'Credit review changed; refresh'using errcode='40001';end if;
 cg:=(p->>'cgstMinor')::bigint;sg:=(p->>'sgstMinor')::bigint;ig:=(p->>'igstMinor')::bigint;
 if cg is null or sg is null or ig is null or cg<0 or sg<0 or ig<0 or cg>inv.cgst_minor or sg>inv.sgst_minor or ig>inv.igst_minor then raise exception 'Reviewed credit exceeds invoice tax'using errcode='23514';end if;
 insert into public.gst_credit_reviews values(c,i,cg,sg,ig,p->>'reviewReference',auth.uid(),now(),1)
 on conflict(company_id,invoice_id)do update set cgst_minor=excluded.cgst_minor,sgst_minor=excluded.sgst_minor,igst_minor=excluded.igst_minor,review_reference=excluded.review_reference,reviewed_by=excluded.reviewed_by,reviewed_at=now(),version=gst_credit_reviews.version+1;
 perform public.audit_event(c,'GST Credit Reviewed','invoice',i,jsonb_build_object('cgstMinor',cg,'sgstMinor',sg,'igstMinor',ig,'reference',p->>'reviewReference'));
end $$;
alter table public.gst_credit_reviews enable row level security;revoke all on public.gst_credit_reviews from anon,authenticated;grant select on public.gst_credit_reviews to authenticated;
create policy gst_credit_read on public.gst_credit_reviews for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on function public.review_gst_credit(uuid,uuid,integer,jsonb)from public,anon,authenticated;grant execute on function public.review_gst_credit(uuid,uuid,integer,jsonb)to authenticated;
commit;
