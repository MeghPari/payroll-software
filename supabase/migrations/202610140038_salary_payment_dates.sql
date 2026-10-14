begin;
-- Confirmed salary can be paid during its payroll month, including before a
-- weekend/holiday month end. Future dates and dates before the payroll month
-- remain invalid. Locked snapshots, captured bank instructions and limits apply.
do $$declare definition text;changed text;begin
 select pg_get_functiondef('public.record_salary_payment(uuid,uuid,uuid,bigint,date,text,text)'::regprocedure)into definition;
 changed:=replace(definition,'payment_date<(run.month+interval ''1 month - 1 day'')::date','payment_date<run.month');if changed=definition then raise exception 'Salary payment date anchor missing';end if;execute changed;
 select pg_get_functiondef('public.record_salary_attempt(uuid,uuid,uuid,jsonb)'::regprocedure)into definition;
 changed:=replace(definition,'attempt_date<(run.month+interval ''1 month - 1 day'')::date','attempt_date<run.month');if changed=definition then raise exception 'Salary attempt date anchor missing';end if;execute changed;
end $$;
commit;
