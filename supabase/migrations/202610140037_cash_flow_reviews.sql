begin;
create table public.cash_flow_reviews(company_id uuid not null,journal_id uuid not null,version integer not null default 1,net_minor bigint not null,allocations jsonb not null,review_reference text not null check(length(trim(review_reference))between 1 and 1000),reviewed_by uuid not null references public.user_profiles(id),reviewed_at timestamptz not null default now(),primary key(company_id,journal_id),foreign key(company_id,journal_id)references public.journal_entries(company_id,id));
create table public.cash_flow_review_history(company_id uuid not null,journal_id uuid not null,version integer not null,content jsonb not null,primary key(company_id,journal_id,version),foreign key(company_id,journal_id)references public.journal_entries(company_id,id));
alter table public.cash_flow_reviews enable row level security;alter table public.cash_flow_review_history enable row level security;
create policy cash_flow_read on public.cash_flow_reviews for select to authenticated using(public.has_permission(company_id,'accounting.read'));
create policy cash_flow_history_read on public.cash_flow_review_history for select to authenticated using(public.has_permission(company_id,'accounting.read'));
revoke all on public.cash_flow_reviews,public.cash_flow_review_history from anon,authenticated;grant select on public.cash_flow_reviews,public.cash_flow_review_history to authenticated;
create function public.review_cash_flow(c uuid,j uuid,expected_version integer,p jsonb)returns void language plpgsql security definer set search_path=''as $$declare entry public.journal_entries;review public.cash_flow_reviews;net bigint;allocated numeric:=0;part jsonb;amount bigint;categories text[]:='{}';begin
 perform public.require_permission(c,'accounting.write');perform 1 from public.companies where id=c for update;
 select * into entry from public.journal_entries where company_id=c and id=j;
 if entry.id is null or entry.status<>'Posted'then raise exception 'Posted cash movement required'using errcode='23514';end if;
 select * into review from public.cash_flow_reviews where company_id=c and journal_id=j for update;
 if expected_version is null or coalesce(review.version,0)<>expected_version then raise exception 'Cash flow review changed; refresh'using errcode='40001';end if;
 select coalesce(sum(l.debit_minor-l.credit_minor),0)into net from public.journal_lines l join public.bank_accounts b on b.company_id=l.company_id and b.account_id=l.account_id where l.company_id=c and l.entry_id=j;
 if net=0 then raise exception 'A nonzero bank or cash movement is required'using errcode='23514';end if;
 if jsonb_typeof(p->'allocations')is distinct from 'array'or jsonb_array_length(p->'allocations')not between 1 and 3 or length(trim(coalesce(p->>'reviewReference','')))not between 1 and 1000 then raise exception 'Reviewed cash flow allocations required'using errcode='22023';end if;
 for part in select value from jsonb_array_elements(p->'allocations')loop
 amount:=(part->>'amountMinor')::bigint;
 if part->>'category'is null or part->>'category'not in('Operating','Investing','Financing')or(part->>'category')=any(categories)or amount is null or abs(amount::numeric)>9000000000000 then raise exception 'Distinct valid cash flow categories and signed amounts required'using errcode='22023';end if;
 categories:=array_append(categories,part->>'category');allocated:=allocated+amount;end loop;
 if allocated<>net then raise exception 'Cash flow allocations must equal the posted cash movement'using errcode='23514';end if;
 insert into public.cash_flow_reviews(company_id,journal_id,net_minor,allocations,review_reference,reviewed_by)values(c,j,net,p->'allocations',trim(p->>'reviewReference'),auth.uid())
 on conflict(company_id,journal_id)do update set net_minor=excluded.net_minor,allocations=excluded.allocations,review_reference=excluded.review_reference,reviewed_by=excluded.reviewed_by,reviewed_at=now(),version=cash_flow_reviews.version+1;
 insert into public.cash_flow_review_history select company_id,journal_id,version,to_jsonb(r)from public.cash_flow_reviews r where company_id=c and journal_id=j;
 perform public.audit_event(c,'Cash Flow Classification Reviewed','journal',j,jsonb_build_object('netMinor',net,'reference',p->>'reviewReference'));
end $$;
revoke all on function public.review_cash_flow(uuid,uuid,integer,jsonb)from public,anon,authenticated;grant execute on function public.review_cash_flow(uuid,uuid,integer,jsonb)to authenticated;
commit;
