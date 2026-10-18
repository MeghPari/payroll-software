-- Apply once after migrations 001-042. Existing payroll and payment records are preserved.
-- Adds client-template imports and reviewed client costs; does not import employee data or execute payments.
begin;
alter table public.employees drop constraint employees_email_check;
alter table public.employees add constraint employees_email_check check(length(email)<=254 and(email=''or email like '%@%'));
alter table public.employees drop constraint employees_last_name_check;
alter table public.employees add constraint employees_last_name_check check(length(last_name)<=100);
alter table public.employees add column counter_code text not null default '' check(length(counter_code)<=80),add column counter_name text not null default '' check(length(counter_name)<=160),add column client_status text check(client_status in('Active','Left','Rejoined'));
alter table public.employee_private_details add column aadhaar_number text not null default '' check(aadhaar_number=''or aadhaar_number~'^[0-9]{12}$');
insert into public.salary_components(code,name,kind)values('da','Dearness Allowance','earning'),('sunday','Sunday Amount','earning'),('incentive','Incentive (excluding Sunday / OT)','earning'),('uniformAdvance','Uniform Advance Recovery','deduction'),('vehicleDamage','Vehicle Damage Recovery','deduction'),('recovery','Prior-month Recovery','deduction');
insert into public.salary_structure_components(company_id,structure_id,component_code,calculation_type,value_minor)select company_id,id,'da','As per record',null from public.salary_structures on conflict do nothing;
alter table public.payroll_adjustments drop constraint payroll_adjustments_kind_check;
alter table public.payroll_adjustments add constraint payroll_adjustments_kind_check check(kind in('overtime','arrears','reimbursement','bonus','otherDeduction','sunday','incentive','uniformAdvance','vehicleDamage','recovery'));
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.calculate_payroll(uuid,date)'::regprocedure);
 changed:=replace(definition,'if item.kind=''otherDeduction''then','if item.kind in(''otherDeduction'',''uniformAdvance'',''vehicleDamage'',''recovery'')then');
 if changed=definition then raise exception 'Unexpected adjustment calculation definition';end if;execute changed;
 definition:=pg_get_functiondef('public.post_payroll_journal_internal(uuid,date,integer)'::regprocedure);
 changed:=replace(definition,'select code,sum(amount_minor),false from public.payroll_run_components where company_id=c and run_id=run.id and kind in(''deduction'',''employer'')group by code','select case when code in(''uniformAdvance'',''vehicleDamage'',''recovery'')then ''otherDeduction''else code end,sum(amount_minor),false from public.payroll_run_components where company_id=c and run_id=run.id and kind in(''deduction'',''employer'')group by case when code in(''uniformAdvance'',''vehicleDamage'',''recovery'')then ''otherDeduction''else code end');
 if changed=definition then raise exception 'Unexpected payroll ledger mapping definition';end if;execute changed;
end $$;

alter function public.save_employee(uuid,jsonb,uuid,integer)rename to save_employee_before_client_template;
revoke all on function public.save_employee_before_client_template(uuid,jsonb,uuid,integer)from public,anon,authenticated;
create function public.save_employee(c uuid,p jsonb,employee_uuid uuid default null,expected_version integer default null)returns uuid
language plpgsql security definer set search_path=''as $$declare eid uuid;begin
 eid:=public.save_employee_before_client_template(c,p,employee_uuid,expected_version);
 if p?'counterCode'or p?'counterName'then
 update public.employees set counter_code=case when p?'counterCode'then coalesce(p->>'counterCode','')else counter_code end,counter_name=case when p?'counterName'then coalesce(p->>'counterName','')else counter_name end where company_id=c and id=eid;
 end if;
 if p#>>'{statutory,aadhaar}'is not null then
 insert into public.employee_private_details(company_id,employee_id,aadhaar_number)values(c,eid,p#>>'{statutory,aadhaar}')on conflict(company_id,employee_id)do update set aadhaar_number=excluded.aadhaar_number;
 perform public.audit_event(c,'Employee Aadhaar Updated','employee',eid);
 end if;return eid;
end $$;
revoke all on function public.save_employee(uuid,jsonb,uuid,integer)from public,anon,authenticated;
grant execute on function public.save_employee(uuid,jsonb,uuid,integer)to authenticated;

create table public.employee_client_salary_references(
 company_id uuid not null,employee_id uuid not null,gross_minor bigint check(gross_minor between 0 and 9000000000000),pf_minor bigint check(pf_minor between 0 and 9000000000000),esi_minor bigint check(esi_minor between 0 and 9000000000000),ctc_minor bigint check(ctc_minor between 0 and 9000000000000),
 recorded_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),primary key(company_id,employee_id),foreign key(company_id,employee_id)references public.employees(company_id,id)
);
alter table public.employee_client_salary_references enable row level security;
revoke all on public.employee_client_salary_references from anon,authenticated;
grant select on public.employee_client_salary_references to authenticated;
create policy client_salary_reference_read on public.employee_client_salary_references for select to authenticated using(public.has_permission(company_id,'salary.read'));

create function public.import_client_employees(c uuid,rows_json jsonb)returns uuid language plpgsql security definer set search_path=''as $$
declare p jsonb;eid uuid;sid uuid;batch uuid;employee_name text;first_name_text text;last_name_text text;v integer;manager uuid;matches integer;local_today date;
begin
 perform public.require_permission(c,'employees.write');perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 500 or octet_length(rows_json::text)>1000000 then raise exception 'Invalid client employee import size'using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(rows_json)entry(value) where entry.value->'amounts'<>'null'::jsonb or entry.value#>>'{salaryReference,grossMinor}'is not null or entry.value#>>'{salaryReference,pfMinor}'is not null or entry.value#>>'{salaryReference,esiMinor}'is not null or entry.value#>>'{salaryReference,ctcMinor}'is not null)then perform public.require_permission(c,'salary.write');end if;
 select(now()at time zone timezone)::date into local_today from public.companies where id=c;
 for p in select value from jsonb_array_elements(rows_json)loop
 if exists(select 1 from public.employees where company_id=c and employee_code=p->>'employeeCode')then raise exception 'Client import cannot overwrite an existing employee code'using errcode='23505';end if;
 employee_name:=regexp_replace(trim(p->>'employeeName'),'[[:space:]]+',' ','g');first_name_text:=split_part(employee_name,' ',1);last_name_text:=case when strpos(employee_name,' ')>0 then substr(employee_name,strpos(employee_name,' ')+1)else ''end;
 if p->>'clientStatus'not in('Active','Left','Rejoined')or(p->>'clientStatus'='Left'and(nullif(p->>'exitDate','')is null or(p->>'exitDate')::date>local_today))or(p->>'clientStatus'<>'Left'and nullif(p->>'exitDate','')is not null)then raise exception 'Invalid client employment status or leaving date'using errcode='22023';end if;
 eid:=public.save_employee(c,jsonb_build_object('employeeCode',p->>'employeeCode','firstName',first_name_text,'lastName',last_name_text,'email','','phone',p->>'phone','joiningDate',p->>'joiningDate','department',p->>'department','designation',p->>'designation','workLocation',p->>'workLocation','state',p->>'state','counterCode',p->>'counterCode','counterName',p->>'counterName','bankDetails',jsonb_build_object('accountHolderName',employee_name,'accountNumber',p->>'accountNumber','ifscCode',p->>'ifscCode'),'statutory',jsonb_build_object('pan',p->>'pan','uan',p->>'uan','esicNumber',p->>'esicNumber')));
 update public.employees set client_status=p->>'clientStatus',status=case when p->>'clientStatus'='Left'then 'Exited'else 'Active'end,exit_date=nullif(p->>'exitDate','')::date where company_id=c and id=eid;
 select version into v from public.employees where company_id=c and id=eid;
 perform public.save_employee_personal(c,eid,v,jsonb_build_object('dateOfBirth',p->>'dateOfBirth','gender',p->>'gender','maritalStatus',p->>'maritalStatus'));
 update public.employee_private_details set aadhaar_number=coalesce(p->>'aadhaar','')where company_id=c and employee_id=eid;
 if p->'amounts'<>'null'::jsonb then
  if nullif(p->>'salaryEffectiveFrom','')is null or(p->>'salaryEffectiveFrom')::date<(p->>'joiningDate')::date then raise exception 'Reviewed salary effective date required'using errcode='22023';end if;
  select id into sid from public.salary_structures where company_id=c and name='Client structured salary'and status='Active';
  if sid is null then sid:=public.save_salary_structure(c,jsonb_build_object('name','Client structured salary','status','Active','components',(select jsonb_agg(jsonb_build_object('code',code,'calculationType','As per record','valueMinor',null))from unnest(array['basic','da','hra','special','conveyance','other','bonus','variable','loan','advance','otherDeduction','employerOther'])code)));end if;
  if p#>>'{salaryReference,grossMinor}'is not null and(p#>>'{salaryReference,grossMinor}')::bigint<>(select sum(value::bigint)from jsonb_each_text(p->'amounts'))then raise exception 'Structured gross does not match components'using errcode='23514';end if;
  perform public.assign_salary(c,eid,sid,(p->>'salaryEffectiveFrom')::date,p->'amounts','Reviewed client employee database import');
 end if;
 insert into public.employee_client_salary_references(company_id,employee_id,gross_minor,pf_minor,esi_minor,ctc_minor,recorded_by)values(c,eid,(p#>>'{salaryReference,grossMinor}')::bigint,(p#>>'{salaryReference,pfMinor}')::bigint,(p#>>'{salaryReference,esiMinor}')::bigint,(p#>>'{salaryReference,ctcMinor}')::bigint,auth.uid());
 perform public.audit_event(c,'Client Employee Imported','employee',eid,jsonb_build_object('clientStatus',p->>'clientStatus','salaryAssigned',p->'amounts'<>'null'::jsonb));
 end loop;
 -- Resolve managers after all employees exist; the normal cycle check remains active.
 for p in select value from jsonb_array_elements(rows_json)where nullif(trim(value->>'reportingManager'),'')is not null loop
 select id,version into eid,v from public.employees where company_id=c and employee_code=p->>'employeeCode';
 select count(*),(array_agg(id))[1]into matches,manager from public.employees where company_id=c and status not in('Exited','Inactive')and(employee_code=p->>'reportingManager'or lower(trim(first_name||' '||last_name))=lower(trim(p->>'reportingManager')));
 if matches<>1 then raise exception 'Reporting manager must uniquely match an active company employee code or full name'using errcode='22023';end if;
 perform public.set_employee_manager(c,eid,manager,v);
 end loop;
 insert into public.employee_import_batches(company_id,actor_id,row_count)values(c,auth.uid(),jsonb_array_length(rows_json))returning id into batch;
 perform public.audit_event(c,'Client Employee Batch Imported','employee_import',batch,jsonb_build_object('rows',jsonb_array_length(rows_json)));return batch;
end $$;
revoke all on function public.import_client_employees(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.import_client_employees(uuid,jsonb)to authenticated;

-- Client billing columns are reviewed separately from employee net pay.
-- No invoice-total formula was supplied in the reference workbook.
create table public.payroll_client_costs(
 company_id uuid not null,employee_id uuid not null,month date not null check(extract(day from month)=1),
 amounts jsonb not null check(jsonb_typeof(amounts)='object'),payroll_version integer not null,version integer not null default 1,
 reviewed_by uuid not null references public.user_profiles(id),review_note text not null check(length(trim(review_note))between 1 and 1000),updated_at timestamptz not null default now(),
 primary key(company_id,employee_id,month),foreign key(company_id,employee_id)references public.employees(company_id,id)
);
alter table public.payroll_client_costs enable row level security;revoke all on public.payroll_client_costs from anon,authenticated;grant select on public.payroll_client_costs to authenticated;
create policy client_cost_read on public.payroll_client_costs for select to authenticated using(public.has_permission(company_id,'salary.read'));
create function public.save_client_payroll_costs(c uuid,e uuid,m date,expected_version integer,payroll_version integer,p jsonb,note text)returns void
language plpgsql security definer set search_path=''as $$declare run public.payroll_runs;old_version integer;item record;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 select * into run from public.payroll_runs where company_id=c and month=m for update;
 if not found or payroll_version is null or expected_version is null or expected_version<0 or m is null or e is null or run.status='Draft'or run.version<>payroll_version then raise exception 'Payroll changed; refresh the client salary sheet'using errcode='40001';end if;
 if not exists(select 1 from public.payroll_run_employees where company_id=c and run_id=run.id and employee_id=e)then raise exception 'Employee outside calculated payroll'using errcode='P0002';end if;
 select version into old_version from public.payroll_client_costs where company_id=c and employee_id=e and month=m;
 if coalesce(old_version,0)<>expected_version then raise exception 'Client cost review changed; refresh'using errcode='40001';end if;
 if p is null or jsonb_typeof(p)<>'object'or octet_length(p::text)>10000 then raise exception 'Invalid client cost inputs'using errcode='22023';end if;
 for item in select key,value from jsonb_each_text(p)loop
 if item.key not in('employerEpf','employerEps','edli','pfAdmin','insurance','serviceCharge','gratuity','invoiceValue')or item.value is null or item.value!~'^[0-9]+$'or item.value::numeric>9000000000000 then raise exception 'Invalid reviewed client cost amount'using errcode='22023';end if;
 end loop;
 insert into public.payroll_client_costs(company_id,employee_id,month,amounts,payroll_version,reviewed_by,review_note)values(c,e,m,p,run.version,auth.uid(),note)
 on conflict(company_id,employee_id,month)do update set amounts=excluded.amounts,payroll_version=excluded.payroll_version,version=payroll_client_costs.version+1,reviewed_by=excluded.reviewed_by,review_note=excluded.review_note,updated_at=now();
 perform public.audit_event(c,'Client Payroll Costs Reviewed','employee',e,jsonb_build_object('month',m,'payrollVersion',run.version,'amounts',p,'note',note));
end $$;
revoke all on function public.save_client_payroll_costs(uuid,uuid,date,integer,integer,jsonb,text)from public,anon,authenticated;
grant execute on function public.save_client_payroll_costs(uuid,uuid,date,integer,integer,jsonb,text)to authenticated;
create function public.import_client_payroll_costs(c uuid,m date,payroll_version integer,rows_json jsonb,note text)returns integer language plpgsql security definer set search_path=''as $$declare row_data jsonb;begin
 perform public.require_permission(c,'salary.write');perform 1 from public.companies where id=c for update;
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 500 or octet_length(rows_json::text)>1000000 then raise exception 'Invalid client cost import size'using errcode='22023';end if;
 if(select count(distinct value->>'employeeId')from jsonb_array_elements(rows_json))<>jsonb_array_length(rows_json)then raise exception 'Duplicate client cost employee'using errcode='22023';end if;
 for row_data in select value from jsonb_array_elements(rows_json)loop perform public.save_client_payroll_costs(c,(row_data->>'employeeId')::uuid,m,(row_data->>'expectedVersion')::integer,payroll_version,row_data->'amounts',note);end loop;
 return jsonb_array_length(rows_json);
end $$;
revoke all on function public.import_client_payroll_costs(uuid,date,integer,jsonb,text)from public,anon,authenticated;
grant execute on function public.import_client_payroll_costs(uuid,date,integer,jsonb,text)to authenticated;
create function public.audit_client_sheet_export(c uuid,m date)returns void language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'payroll.run');perform public.require_permission(c,'salary.read');perform public.require_permission(c,'employees.sensitive');
 perform public.audit_event(c,'Client Salary Sheet Exported','company',c,jsonb_build_object('month',m));
end $$;
revoke all on function public.audit_client_sheet_export(uuid,date)from public,anon,authenticated;
grant execute on function public.audit_client_sheet_export(uuid,date)to authenticated;
create function public.audit_client_employee_export(c uuid)returns void language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'employees.sensitive');perform public.require_permission(c,'salary.read');
 perform public.audit_event(c,'Client Employee Database Exported','company',c);
end $$;
revoke all on function public.audit_client_employee_export(uuid)from public,anon,authenticated;
grant execute on function public.audit_client_employee_export(uuid)to authenticated;
commit;
