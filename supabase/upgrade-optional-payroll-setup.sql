begin;
-- Bank instructions are validated separately when preparing salary payments.
-- Unknown statutory flags remain unknown; no employee records are defaulted.
alter function public.validate_payroll(uuid,date) rename to validate_payroll_before_optional_setup;
revoke all on function public.validate_payroll_before_optional_setup(uuid,date) from public,anon,authenticated;
create function public.validate_payroll(c uuid,m date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare checks jsonb; issues jsonb; blockers integer; warnings integer;
begin
 checks:=public.validate_payroll_before_optional_setup(c,m);
 select coalesce(jsonb_agg(case
 when item->>'check'='Missing Bank Details' then item||jsonb_build_object('severity','Warning','message','Bank details are optional for calculation. Complete them before preparing bank payments.')
 when item->>'check'='Statutory Configuration' then item||jsonb_build_object('severity','Warning','message','Statutory setup is incomplete. Unconfigured deductions are excluded; calculated net pay is provisional until setup is reviewed.')
 else item end),'[]'::jsonb) into issues from jsonb_array_elements(checks->'issues') item;
 select count(*) filter(where item->>'severity'='Blocking Error'),count(*) filter(where item->>'severity'='Warning') into blockers,warnings from jsonb_array_elements(issues)item;
 return checks||jsonb_build_object('issues',issues,'blockingErrors',blockers,'warnings',warnings,'passed',case when blockers=0 then (checks->>'totalChecked')::integer else 0 end);
end $$;
revoke all on function public.validate_payroll(uuid,date) from public,anon,authenticated;
grant execute on function public.validate_payroll(uuid,date) to authenticated;
-- Preserve all existing proration, adjustments, rounding, audit and locking logic.
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.calculate_payroll(uuid,date)'::regprocedure);
 changed:=replace(definition,'jsonb_build_object(''employeeCode'',','jsonb_build_object(''setupWarnings'',validation->''issues'',''employeeCode'',');
 if changed=definition then raise exception 'Unexpected payroll snapshot definition';end if;
 -- A partially configured employee can still have an explicitly applicable rule.
 -- Never silently skip that deduction when its reviewed rule is absent.
 definition:=changed;
 changed:=replace(definition,'select coalesce(sum(coalesce((amounts->>code)::bigint,0)),0)into wage', 'if not found then raise exception ''A configured statutory deduction needs a reviewed rule covering the month'' using errcode=''23514'';end if; select coalesce(sum(coalesce((amounts->>code)::bigint,0)),0)into wage');
 if changed=definition then raise exception 'Unexpected statutory calculation definition';end if;
 execute changed;
end $$;
commit;
