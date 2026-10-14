begin;
-- Request-scoped authorization remains authoritative; combine its reads to
-- avoid multiple provider round trips. Data RPCs/RLS still authorize independently.
create function public.authorize_company_request(c uuid,permission_code text,bucket_name text)returns jsonb language plpgsql security definer set search_path=''as $$declare membership_role text;quota jsonb;begin
 select m.role into membership_role from public.user_company_roles m join public.user_profiles p on p.id=m.user_id where m.company_id=c and m.user_id=auth.uid()and m.active and p.active;
 if not found then raise exception 'Company access denied'using errcode='42501';end if;
 if permission_code is not null and not exists(select 1 from public.role_permissions where role=membership_role and permission=permission_code)then raise exception 'Permission denied'using errcode='42501';end if;
 quota:=public.consume_application_request(c,bucket_name);return quota||jsonb_build_object('role',membership_role);
end $$;
create function public.session_context()returns jsonb language plpgsql stable security definer set search_path=''as $$declare memberships jsonb;permissions jsonb;begin
 if not exists(select 1 from public.user_profiles where id=auth.uid()and active)then raise exception 'Account inactive or not provisioned'using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('company_id',m.company_id,'role',m.role,'companies',jsonb_build_object('id',c.id,'name',c.name))order by c.name,m.company_id),'[]')into memberships from public.user_company_roles m join public.companies c on c.id=m.company_id where m.user_id=auth.uid()and m.active;
 select coalesce(jsonb_agg(jsonb_build_object('role',role,'permission',permission)order by role,permission),'[]')into permissions from public.role_permissions;
 return jsonb_build_object('memberships',memberships,'permissions',permissions);
end $$;
revoke all on function public.authorize_company_request(uuid,text,text),public.session_context()from public,anon,authenticated;
grant execute on function public.authorize_company_request(uuid,text,text),public.session_context()to authenticated;
commit;
