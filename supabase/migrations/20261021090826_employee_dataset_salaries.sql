-- Run after migrations 001-048. If 049/050 were applied, run rollback-client-changes.sql first.
-- No employees, attendance, salary history or financial snapshots are deleted.
begin;
do $$begin
 if position('Upload the Employee Database' in pg_get_functiondef('public.save_employee(uuid,jsonb,uuid,integer)'::regprocedure))>0 then raise exception 'Run rollback-client-changes.sql before this upgrade';end if;
end $$;
alter table public.employee_salary_assignments add column dataset_salary boolean not null default false;
update public.employee_salary_assignments a set dataset_salary=true where remarks in('Reviewed client employee database import','Authoritative Employee Database import') or to_jsonb(a)->>'master_source_id' is not null;
create index dataset_salary_lookup on public.employee_salary_assignments(company_id,employee_id,effective_from)where dataset_salary;
update public.salary_structures s set status='Archived'where exists(select 1 from public.designation_salary_presets p where p.company_id=s.company_id and p.structure_id=s.id);
update public.designation_salary_presets set active=false;
create or replace function public.seed_designation_presets_internal(c uuid)returns void language plpgsql set search_path=''as $$begin return;end $$;
create or replace function public.seed_legacy_designation_presets_internal(c uuid)returns void language plpgsql set search_path=''as $$begin return;end $$;
create or replace function public.save_employee(c uuid,p jsonb,employee_uuid uuid default null,expected_version integer default null)returns uuid language plpgsql security definer set search_path=''as $$begin
 return public.save_employee_before_designation(c,p,employee_uuid,expected_version);
end $$;
revoke all on function public.initialize_designation_presets(uuid),public.save_designation_salary_preset(uuid,uuid,integer,text,jsonb,boolean),public.apply_designation_salaries(uuid),public.use_employee_designation_salary(uuid,uuid,date,integer),public.assign_designation_salary_private(uuid,uuid,uuid,date,jsonb,text),public.apply_designation_salary_internal(uuid,uuid,boolean,date)from public,anon,authenticated;
create or replace function public.assign_salary(c uuid,e uuid,s uuid,effective date,amounts jsonb,remarks_text text default '')returns uuid language plpgsql set search_path=''as $$begin raise exception 'Upload the employee dataset to save salary components.'using errcode='P0051';end $$;
create or replace function public.salary_assignment_at(c uuid,e uuid,d date)returns uuid language sql stable set search_path=''as $$
 select a.id from public.employee_salary_assignments a where a.company_id=c and a.employee_id=e and a.dataset_salary
 order by(a.effective_from<=d)desc,case when a.effective_from<=d then a.effective_from end desc,a.effective_from,a.id limit 1
$$;
create function public.import_employee_dataset(c uuid,rows_json jsonb,update_existing boolean default false,expected_versions jsonb default '{}')returns uuid language plpgsql security definer set search_path=''as $$
declare p jsonb;eid uuid;sid uuid;batch uuid;employee_name text;first_name_text text;last_name_text text;v integer;manager uuid;matches integer;local_today date;old_emp public.employees;aid uuid;prior_amounts jsonb;
begin
 perform public.require_permission(c,'employees.write');perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 500 or octet_length(rows_json::text)>1000000 then raise exception 'Invalid client employee import size'using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(rows_json)entry(value) where entry.value->'amounts'<>'null'::jsonb or entry.value#>>'{salaryReference,grossMinor}'is not null or entry.value#>>'{salaryReference,pfMinor}'is not null or entry.value#>>'{salaryReference,esiMinor}'is not null or entry.value#>>'{salaryReference,ctcMinor}'is not null)then perform public.require_permission(c,'salary.write');end if;
 perform public.require_permission(c,'employees.write');perform public.require_permission(c,'employees.sensitive');perform public.require_permission(c,'salary.write');
 if (select count(distinct upper(trim(value->>'employeeCode')))from jsonb_array_elements(rows_json))<>jsonb_array_length(rows_json) then raise exception 'Duplicate employee codes in file' using errcode='P0051';end if;
 select(now()at time zone timezone)::date into local_today from public.companies where id=c;
 for p in select value from jsonb_array_elements(rows_json)loop
 old_emp:=null;aid:=null;prior_amounts:=null;
 if coalesce(p->>'employeeCode','')!~'^[A-Za-z0-9_-]{1,40}$' or nullif(trim(p->>'employeeName'),'')is null then raise exception 'Employee Code and Employee Name are required'using errcode='P0051';end if;
 if jsonb_typeof(p->'amounts')is distinct from 'object' then raise exception 'All four salary components are required; enter 0 for unused components.'using errcode='P0051';end if;
 if(select count(*)from jsonb_object_keys(p->'amounts'))<>4 or not(p->'amounts'?&array['basic','da','hra','other'])then raise exception 'All four salary components are required'using errcode='P0051';end if;
 if exists(select 1 from jsonb_each_text(p->'amounts')v where coalesce(v.value,'')!~'^[0-9]+$')then raise exception 'Invalid salary components'using errcode='P0051';end if;
 if exists(select 1 from jsonb_each_text(p->'amounts')v where v.value::numeric>9000000000000)then raise exception 'Invalid salary components'using errcode='P0051';end if;
 if(select count(*)from public.employees where company_id=c and upper(trim(employee_code))=upper(trim(p->>'employeeCode')))>1 then raise exception 'Employee Code is ambiguous; correct duplicate codes first.'using errcode='P0051';end if;
 select * into old_emp from public.employees where company_id=c and upper(trim(employee_code))=upper(trim(p->>'employeeCode'))for update;
 if old_emp.id is not null then
 if not coalesce(update_existing,false)then raise exception 'Employee exists; enable reviewed updates.'using errcode='P0051';end if;
 if coalesce((expected_versions->>upper(trim(p->>'employeeCode')))::integer,-1)<>old_emp.version then raise exception 'Employee changed; validate the file again'using errcode='40001';end if;
 p:=p||jsonb_build_object('employeeCode',old_emp.employee_code);
 end if;
 employee_name:=regexp_replace(trim(p->>'employeeName'),'[[:space:]]+',' ','g');first_name_text:=split_part(employee_name,' ',1);last_name_text:=case when strpos(employee_name,' ')>0 then substr(employee_name,strpos(employee_name,' ')+1)else ''end;
 if p->>'clientStatus'not in('Active','Left','Rejoined')or(p->>'clientStatus'='Left'and(nullif(p->>'exitDate','')is null or(p->>'exitDate')::date>local_today))or(p->>'clientStatus'<>'Left'and nullif(p->>'exitDate','')is not null)then raise exception 'Invalid client employment status or leaving date'using errcode='22023';end if;
 eid:=public.save_employee(c,jsonb_build_object('employeeCode',p->>'employeeCode','firstName',first_name_text,'lastName',last_name_text,'email','','phone',p->>'phone','joiningDate',p->>'joiningDate','department',p->>'department','designation',p->>'designation','workLocation',p->>'workLocation','state',p->>'state','counterCode',p->>'counterCode','counterName',p->>'counterName','bankDetails',jsonb_build_object('accountHolderName',employee_name,'accountNumber',p->>'accountNumber','ifscCode',p->>'ifscCode'),'statutory',jsonb_build_object('pan',p->>'pan','uan',p->>'uan','esicNumber',p->>'esicNumber')),old_emp.id,old_emp.version);
 update public.employees set client_status=p->>'clientStatus',status=case when p->>'clientStatus'='Left'then 'Exited'else 'Active'end,exit_date=nullif(p->>'exitDate','')::date where company_id=c and id=eid;
 select version into v from public.employees where company_id=c and id=eid;
 perform public.save_employee_personal(c,eid,v,jsonb_build_object('dateOfBirth',p->>'dateOfBirth','gender',p->>'gender','maritalStatus',p->>'maritalStatus'));
 update public.employee_private_details set aadhaar_number=coalesce(p->>'aadhaar','')where company_id=c and employee_id=eid;
 if p->'amounts'<>'null'::jsonb then
  if nullif(p->>'salaryEffectiveFrom','')is null or(p->>'salaryEffectiveFrom')::date<(p->>'joiningDate')::date then raise exception 'Reviewed salary effective date required'using errcode='22023';end if;
  select id into sid from public.salary_structures where company_id=c and name='Employee dataset salary'and status='Active';
  if sid is null then
   insert into public.salary_structures(company_id,name,status)values(c,'Employee dataset salary','Active')returning id into sid;
   insert into public.salary_structure_components(company_id,structure_id,component_code,calculation_type)select c,sid,code,'Uploaded amount'from unnest(array['basic','da','hra','other'])code;
  end if;
  if p#>>'{salaryReference,grossMinor}'is not null and(p#>>'{salaryReference,grossMinor}')::bigint<>(select sum(value::bigint)from jsonb_each_text(p->'amounts'))then raise exception 'Structured gross does not match components'using errcode='23514';end if;
  select a.id into aid from public.employee_salary_assignments a where a.company_id=c and a.employee_id=eid and a.effective_from=(p->>'salaryEffectiveFrom')::date and a.dataset_salary;
  if aid is not null then
   select jsonb_object_agg(component_code,amount_minor)into prior_amounts from public.employee_salary_component_values where company_id=c and assignment_id=aid;
   if prior_amounts is distinct from p->'amounts' then raise exception 'Salary already exists on this effective date. Choose a new revision date; saved salary history is retained.'using errcode='P0051';end if;
  else
   if exists(select 1 from public.employee_salary_assignments where company_id=c and employee_id=eid and effective_from=(p->>'salaryEffectiveFrom')::date)then raise exception 'A previous salary uses this date. Choose a new dataset salary revision date; the first dataset salary also covers earlier employment months.'using errcode='P0051';end if;
   aid:=public.assign_salary_before_designation(c,eid,sid,(p->>'salaryEffectiveFrom')::date,p->'amounts','Employee dataset upload');
   update public.employee_salary_assignments set dataset_salary=true where company_id=c and id=aid;
  end if;
  update public.employees set salary_mode='custom'where company_id=c and id=eid;
 end if;
 insert into public.employee_client_salary_references(company_id,employee_id,gross_minor,pf_minor,esi_minor,ctc_minor,recorded_by)values(c,eid,(p#>>'{salaryReference,grossMinor}')::bigint,(p#>>'{salaryReference,pfMinor}')::bigint,(p#>>'{salaryReference,esiMinor}')::bigint,(p#>>'{salaryReference,ctcMinor}')::bigint,auth.uid())on conflict(company_id,employee_id)do update set gross_minor=excluded.gross_minor,pf_minor=excluded.pf_minor,esi_minor=excluded.esi_minor,ctc_minor=excluded.ctc_minor,recorded_by=excluded.recorded_by;
 perform public.audit_event(c,'Client Employee Imported','employee',eid,jsonb_build_object('clientStatus',p->>'clientStatus','salaryAssigned',p->'amounts'<>'null'::jsonb));
 end loop;
 -- Resolve managers after all employees exist; the normal cycle check remains active.
 for p in select value from jsonb_array_elements(rows_json)where nullif(trim(value->>'reportingManager'),'')is not null loop
 select id,version into eid,v from public.employees where company_id=c and upper(trim(employee_code))=upper(trim(p->>'employeeCode'));
 select count(*),(array_agg(id))[1]into matches,manager from public.employees where company_id=c and status not in('Exited','Inactive')and(upper(trim(employee_code))=upper(trim(p->>'reportingManager'))or lower(trim(first_name||' '||last_name))=lower(trim(p->>'reportingManager')));
 if matches<>1 then raise exception 'Reporting manager must uniquely match an active company employee code or full name'using errcode='22023';end if;
 perform public.set_employee_manager(c,eid,manager,v);
 end loop;
 insert into public.employee_import_batches(company_id,actor_id,row_count)values(c,auth.uid(),jsonb_array_length(rows_json))returning id into batch;
 perform public.audit_event(c,'Client Employee Batch Imported','employee_import',batch,jsonb_build_object('rows',jsonb_array_length(rows_json)));return batch;
end $$;

revoke all on function public.import_employee_dataset(uuid,jsonb,boolean,jsonb)from public,anon,authenticated;
grant execute on function public.import_employee_dataset(uuid,jsonb,boolean,jsonb)to authenticated;
create or replace function public.import_client_employees(c uuid,rows_json jsonb)returns uuid language plpgsql security definer set search_path=''as $$begin return public.import_employee_dataset(c,rows_json,false,'{}');end $$;
do $$declare definition text;begin
 definition:=pg_get_functiondef('public.validate_payroll_internal(uuid,date)'::regprocedure);
 definition:=replace(definition,'Assign a salary once; it covers all months of employment until revised.','Upload this employee in the Employee Dataset with complete salary components, then calculate again.');
 execute definition;
end $$;
-- Require recalculation before approving any earlier unapproved preview.
update public.companies set payroll_input_version=payroll_input_version+1;
notify pgrst,'reload schema';
commit;
