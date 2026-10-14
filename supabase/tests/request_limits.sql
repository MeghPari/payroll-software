begin;
insert into auth.users(id,email,email_confirmed_at)values('b1000000-0000-4000-8000-000000000001','limits@example.invalid',now()),('b1000000-0000-4000-8000-000000000002','limits-other@example.invalid',now());
insert into public.user_profiles(id)select id from auth.users where id::text like 'b1000000%';
insert into public.companies(id,name)values('b2000000-0000-4000-8000-000000000001','Limits fixture'),('b2000000-0000-4000-8000-000000000002','Other membership');
insert into public.user_company_roles(company_id,user_id,role)values('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Employee'),('b2000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001','Employee'),('b2000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','Employee');
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);set local role authenticated;
do $$declare response jsonb;begin
 response:=public.authorize_company_request('b2000000-0000-4000-8000-000000000001',null,'read');if response->>'role'<>'Employee'then raise exception 'FAIL verified request role';end if;
 if jsonb_array_length(public.session_context()->'memberships')<>2 then raise exception 'FAIL own session memberships';end if;
 begin perform public.authorize_company_request('b2000000-0000-4000-8000-000000000001','users.manage','write');raise exception 'FAIL atomic unauthorized permission';exception when insufficient_privilege then null;end;
 response:=public.consume_application_request('b2000000-0000-4000-8000-000000000001','write');if not(response->>'allowed')::boolean then raise exception 'FAIL initial quota';end if;
 begin perform public.consume_application_request('b2000000-0000-4000-8000-000000000099','write');raise exception 'FAIL unauthorized limiter';exception when insufficient_privilege then null;end;
 begin delete from public.application_request_limits;raise exception 'FAIL counter bypass';exception when insufficient_privilege then null;end;
 begin perform public.consume_application_request('b2000000-0000-4000-8000-000000000001','unlimited');raise exception 'FAIL unknown bucket';exception when invalid_parameter_value then null;end;
end $$;
reset role;
-- Seed the current window near its write limit; only the test administrator can do this.
update public.application_request_limits set used=60,window_start=floor(extract(epoch from clock_timestamp()))::bigint/60 where user_id='b1000000-0000-4000-8000-000000000001'and bucket='write';
set local role authenticated;
do $$declare response jsonb;begin
 response:=public.consume_application_request('b2000000-0000-4000-8000-000000000002','write');if(response->>'allowed')::boolean or(response->>'retrySeconds')::integer not between 1 and 60 then raise exception 'FAIL shared-company rate limit';end if;
 response:=public.consume_application_request('b2000000-0000-4000-8000-000000000001','read');if not(response->>'allowed')::boolean then raise exception 'FAIL independent read bucket';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000002',true);set local role authenticated;
do $$begin if not(public.consume_application_request('b2000000-0000-4000-8000-000000000001','write')->>'allowed')::boolean then raise exception 'FAIL another user exhausted';end if;end $$;
reset role;
select set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000001',true);
update public.application_request_limits set window_start=window_start-2 where user_id='b1000000-0000-4000-8000-000000000001'and bucket='write';
set local role authenticated;
do $$begin if not(public.consume_application_request('b2000000-0000-4000-8000-000000000001','write')->>'allowed')::boolean then raise exception 'FAIL expired window not reset';end if;end $$;
reset role;
rollback;
