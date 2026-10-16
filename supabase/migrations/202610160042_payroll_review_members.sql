begin;
-- Capture only this employee's optional-setup warnings in future calculations.
-- Existing locked runs and published payslips are retained.
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.calculate_payroll(uuid,date)'::regprocedure);
 changed:=replace(definition,'''setupWarnings'',validation->''issues''','''setupWarnings'',(select coalesce(jsonb_agg(issue),''[]''::jsonb) from jsonb_array_elements(validation->''issues'')issue where issue->>''employeeId''=emp.id::text and issue->>''severity''=''Warning'')');
 if changed=definition then raise exception 'Apply migration 041 before this update';end if;
 execute changed;
end $$;

-- Check explicitly applicable deductions even when another flag is still unset.
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.validate_payroll_internal(uuid,date)'::regprocedure);
 changed:=replace(definition,E'  else\n   if stat.pf_applicable',E'  end if;\n  if true then\n   if stat.pf_applicable');
 if changed=definition then raise exception 'Unexpected statutory validation definition';end if;
 execute changed;
 -- Recheck the operator after acquiring the membership serialization lock.
 definition:=pg_get_functiondef('public.set_company_member(uuid,uuid,text,boolean)'::regprocedure);
 changed:=replace(definition,'perform 1 from public.companies where id=c for update;','perform 1 from public.companies where id=c for update; perform public.require_permission(c,''users.manage'');');
 if changed=definition then raise exception 'Unexpected membership definition';end if;
 execute changed;
end $$;

-- Names and emails are disclosed only to administrators of this company.
create function public.list_company_members(c uuid)
returns table(user_id uuid,role text,active boolean,created_at timestamptz,display_name text,email text)
language plpgsql security definer set search_path='' as $$begin
 perform public.require_permission(c,'users.manage');
 return query select m.user_id,m.role,m.active,m.created_at,
 coalesce(nullif(trim(p.display_name),''),nullif(trim(to_jsonb(u)->'raw_user_meta_data'->>'display_name'),''),nullif(trim(to_jsonb(u)->'raw_user_meta_data'->>'full_name'),''),'Account'),u.email::text
 from public.user_company_roles m join public.user_profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id
 where m.company_id=c order by m.created_at,m.user_id;
end $$;
create function public.set_company_member_by_email(c uuid,email_text text,next_role text,is_active boolean)
returns void language plpgsql security definer set search_path='' as $$declare target uuid;begin
 perform public.require_permission(c,'users.manage');
 if length(trim(coalesce(email_text,''))) not between 3 and 254 then raise exception 'Valid account email required'using errcode='22023';end if;
 select id into target from auth.users where lower(email)=lower(trim(email_text)) and email_confirmed_at is not null;
 if target is null then raise exception 'Confirmed account not found. Create or invite the account in Supabase Authentication first, then assign access here.'using errcode='P0002';end if;
 perform public.set_company_member(c,target,next_role,is_active);
end $$;
revoke all on function public.list_company_members(uuid),public.set_company_member_by_email(uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.list_company_members(uuid),public.set_company_member_by_email(uuid,text,text,boolean) to authenticated;
commit;
