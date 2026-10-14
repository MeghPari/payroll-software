begin;
create function public.link_employee_account(c uuid,e uuid,u uuid,expected_version integer,reason_text text)returns void language plpgsql security definer set search_path=''as $$declare previous_user uuid;v integer;begin
 perform public.require_permission(c,'users.manage');perform public.require_permission(c,'employees.write');
 perform 1 from public.companies where id=c for update;
 select user_id,version into previous_user,v from public.employees where company_id=c and id=e for update;
 if not found then raise exception 'Employee not found'using errcode='P0002';end if;
 if expected_version is null or v<>expected_version then raise exception 'Employee changed; refresh'using errcode='40001';end if;
 if reason_text is null or length(trim(reason_text))not between 1 and 1000 then raise exception 'Account link reason required'using errcode='22023';end if;
 if u is not null and not exists(select 1 from public.user_company_roles m join public.user_profiles p on p.id=m.user_id join auth.users a on a.id=p.id where m.company_id=c and m.user_id=u and m.active and p.active and a.email_confirmed_at is not null)then raise exception 'Confirmed active company account required'using errcode='23514';end if;
 if u is not null and exists(select 1 from public.employees where company_id=c and user_id=u and id<>e)then raise exception 'Account already linked to another employee'using errcode='23505';end if;
 if previous_user is not distinct from u then return;end if;
 update public.employees set user_id=u,version=version+1,updated_at=now()where company_id=c and id=e;
 perform public.audit_event(c,'Employee Account Link Changed','employee',e,jsonb_build_object('previousUserId',previous_user,'userId',u,'reason',trim(reason_text)));
end $$;
revoke all on function public.link_employee_account(uuid,uuid,uuid,integer,text)from public,anon,authenticated;
grant execute on function public.link_employee_account(uuid,uuid,uuid,integer,text)to authenticated;
commit;
