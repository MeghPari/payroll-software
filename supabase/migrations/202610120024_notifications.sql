begin;
create table public.notifications(id uuid primary key default gen_random_uuid(),company_id uuid not null,user_id uuid not null,title text not null check(length(title)between 1 and 300),href text not null check(href in('/announcements','/support','/payslips','/attendance')),event_key text not null,created_at timestamptz not null default now(),read_at timestamptz,unique(company_id,user_id,event_key),foreign key(company_id,user_id)references public.user_company_roles(company_id,user_id));
create index notifications_inbox on public.notifications(company_id,user_id,created_at desc);
alter table public.notifications enable row level security;revoke all on public.notifications from anon,authenticated;grant select on public.notifications to authenticated;
create policy notification_own on public.notifications for select to authenticated using(user_id=auth.uid()and public.is_member(company_id));
create function public.notify_member(c uuid,u uuid,message_text text,path text,event text)returns void language plpgsql security definer set search_path=''as $$begin
 if exists(select 1 from public.user_company_roles m join public.user_profiles p on p.id=m.user_id where m.company_id=c and m.user_id=u and m.active and p.active)then
 insert into public.notifications(company_id,user_id,title,href,event_key)values(c,u,message_text,path,event)on conflict(company_id,user_id,event_key)do nothing;end if;
end $$;
create function public.announcement_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare u uuid;begin
 if new.status<>'Published'then return new;end if;if tg_op='UPDATE'and old.status='Published'then return new;end if;
 for u in select user_id from public.user_company_roles where company_id=new.company_id and active and user_id<>auth.uid()loop perform public.notify_member(new.company_id,u,'A company announcement was published','/announcements','announcement:'||new.id||':'||new.version);end loop;return new;
end $$;
create trigger announcement_notifications after insert or update on public.announcements for each row execute function public.announcement_notifications();
create function public.ticket_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare t public.support_tickets;begin
 select * into t from public.support_tickets where company_id=new.company_id and id=new.ticket_id;
 if t.created_by<>new.created_by then perform public.notify_member(new.company_id,t.created_by,'A response was added to your support ticket','/support','support:'||new.id);end if;return new;
end $$;
create trigger ticket_notifications after insert on public.support_messages for each row execute function public.ticket_notifications();
create function public.payslip_notifications()returns trigger language plpgsql security definer set search_path=''as $$declare u uuid;begin
 if new.status<>'Published'then return new;end if;if tg_op='UPDATE'and old.status='Published'then return new;end if;
 select user_id into u from public.employees where company_id=new.company_id and id=new.employee_id;
 if u is not null then perform public.notify_member(new.company_id,u,'Your payslip for '||to_char(new.month,'YYYY-MM')||' is available','/payslips','payslip:'||new.id);end if;return new;
end $$;
create trigger payslip_notifications after insert or update on public.payslips for each row execute function public.payslip_notifications();
create function public.mark_notifications_read(c uuid,ids uuid[])returns integer language plpgsql security definer set search_path=''as $$declare n integer;begin
 if not public.is_member(c)then raise exception 'Company access denied'using errcode='42501';end if;
 if cardinality(ids)not between 1 and 100 then raise exception 'Select up to 100 notifications'using errcode='22023';end if;
 update public.notifications set read_at=now()where company_id=c and user_id=auth.uid()and id=any(ids)and read_at is null;get diagnostics n=row_count;return n;
end $$;
revoke all on function public.notify_member(uuid,uuid,text,text,text),public.announcement_notifications(),public.ticket_notifications(),public.payslip_notifications(),public.mark_notifications_read(uuid,uuid[])from public,anon,authenticated;
grant execute on function public.mark_notifications_read(uuid,uuid[])to authenticated;
commit;
