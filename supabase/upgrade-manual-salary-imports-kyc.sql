-- Apply after upgrade-reset-payroll-month.sql. No existing payroll is recalculated.
begin;
create function public.save_employee_salary_components(c uuid,e uuid,effective date,amounts jsonb,reference_values jsonb,expected_version integer,remarks_text text default '')returns uuid
language plpgsql security definer set search_path=''as $$
declare emp public.employees;sid uuid;aid uuid;existing_amounts jsonb;normalized jsonb;gross bigint;item text;begin
 perform public.require_permission(c,'salary.write');perform public.require_permission(c,'employees.sensitive');
 perform 1 from public.companies where id=c for update;
 perform public.require_permission(c,'salary.write');perform public.require_permission(c,'employees.sensitive');
 select * into emp from public.employees where company_id=c and id=e for update;
 if emp.id is null then raise exception 'Employee not found'using errcode='P0002';end if;
 if expected_version is null or expected_version<>emp.version then raise exception 'Employee changed; refresh before saving salary'using errcode='40001';end if;
 if effective is null or effective<emp.joining_date or(emp.exit_date is not null and effective>emp.exit_date)then raise exception 'Salary effective date must be within employment'using errcode='22023';end if;
 if jsonb_typeof(amounts)is distinct from 'object'or not(amounts?'basic')then raise exception 'Structured Basic is required'using errcode='22023';end if;
 if exists(select 1 from jsonb_each_text(amounts)v where key not in('basic','da','hra','other')or coalesce(value,'')!~'^[0-9]+$')then raise exception 'Invalid salary component'using errcode='22023';end if;
 normalized:=jsonb_build_object('basic',amounts->'basic','da',coalesce(amounts->'da','0'),'hra',coalesce(amounts->'hra','0'),'other',coalesce(amounts->'other','0'));
 if exists(select 1 from jsonb_each_text(normalized)v where value::numeric>9000000000000)then raise exception 'Salary amount is too large'using errcode='22023';end if;
 select sum(value::bigint)into gross from jsonb_each_text(normalized);
 if gross>9000000000000 then raise exception 'Salary gross is too large'using errcode='22023';end if;
 if jsonb_typeof(reference_values)is distinct from 'object'or length(coalesce(remarks_text,''))>1000 then raise exception 'Invalid salary references or remarks'using errcode='22023';end if;
 for item in select key from jsonb_each(reference_values)loop
  if item not in('pfMinor','esiMinor','ctcMinor')or(reference_values->item<>'null'::jsonb and(coalesce(reference_values->>item,'')!~'^[0-9]+$'))then raise exception 'Invalid reference amount'using errcode='22023';end if;
  if(reference_values->>item)::numeric>9000000000000 then raise exception 'Reference amount too large'using errcode='22023';end if;
 end loop;
 select id into sid from public.salary_structures where company_id=c and name='Employee dataset salary'and status='Active';
 if sid is null then
  insert into public.salary_structures(company_id,name,status)values(c,'Employee dataset salary','Active')returning id into sid;
  insert into public.salary_structure_components(company_id,structure_id,component_code,calculation_type)select c,sid,code,'Uploaded amount'from unnest(array['basic','da','hra','other'])code;
 end if;
 select id into aid from public.employee_salary_assignments where company_id=c and employee_id=e and effective_from=effective and dataset_salary;
 if aid is not null then
  select jsonb_object_agg(component_code,amount_minor)into existing_amounts from public.employee_salary_component_values where company_id=c and assignment_id=aid;
  if existing_amounts is distinct from normalized then raise exception 'Salary already uses this date. Choose a new revision date; previous salary history is retained.'using errcode='P0051';end if;
 else
  aid:=public.assign_salary_before_designation(c,e,sid,effective,normalized,coalesce(nullif(remarks_text,''),'Employee salary entry'));
  update public.employee_salary_assignments set dataset_salary=true where company_id=c and id=aid;
 end if;
 insert into public.employee_client_salary_references(company_id,employee_id,gross_minor,pf_minor,esi_minor,ctc_minor,recorded_by)
 values(c,e,gross,(reference_values->>'pfMinor')::bigint,(reference_values->>'esiMinor')::bigint,(reference_values->>'ctcMinor')::bigint,auth.uid())
 on conflict(company_id,employee_id)do update set gross_minor=excluded.gross_minor,pf_minor=coalesce(excluded.pf_minor,employee_client_salary_references.pf_minor),esi_minor=coalesce(excluded.esi_minor,employee_client_salary_references.esi_minor),ctc_minor=coalesce(excluded.ctc_minor,employee_client_salary_references.ctc_minor),recorded_by=excluded.recorded_by;
 update public.employees set salary_mode='custom',version=version+1,updated_at=now()where company_id=c and id=e;
 perform public.audit_event(c,'Employee Salary Components Saved','employee',e,jsonb_build_object('assignmentId',aid,'effectiveFrom',effective,'grossMinor',gross));return aid;
end $$;
revoke all on function public.save_employee_salary_components(uuid,uuid,date,jsonb,jsonb,integer,text)from public,anon,authenticated;
grant execute on function public.save_employee_salary_components(uuid,uuid,date,jsonb,jsonb,integer,text)to authenticated;

create function public.employee_kyc_requirements(c uuid,e uuid)returns jsonb language plpgsql stable security definer set search_path=''as $$declare document_status text;begin
 perform public.require_permission(c,'employees.sensitive');
 if not exists(select 1 from public.employees where company_id=c and id=e)then raise exception 'Employee not found'using errcode='P0002';end if;
 if exists(select 1 from public.employee_documents where company_id=c and employee_id=e and document_type='Aadhaar'and status='Verified')then document_status:='Verified';
 else select d.status into document_status from public.employee_documents d where company_id=c and employee_id=e and document_type='Aadhaar'and d.status not in('Removed','Uploading')order by d.uploaded_at desc,d.id desc limit 1;end if;
 return jsonb_build_object('aadhaarStatus',coalesce(document_status,'Not Provided'),'complete',coalesce(document_status='Verified',false),'requiredDocument','Aadhaar');
end $$;
revoke all on function public.employee_kyc_requirements(uuid,uuid)from public,anon,authenticated;
grant execute on function public.employee_kyc_requirements(uuid,uuid)to authenticated;

create or replace function public.import_employee_dataset(c uuid,rows_json jsonb,update_existing boolean default false,expected_versions jsonb default '{}')returns uuid language plpgsql security definer set search_path=''as $$
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
 if p->'amounts' is not null and p->'amounts'<>'null'::jsonb then
 if jsonb_typeof(p->'amounts')<>'object'or not(p->'amounts'?'basic')then raise exception 'Structured Basic is required when salary is supplied'using errcode='P0051';end if;
 if exists(select 1 from jsonb_each_text(p->'amounts')v where key not in('basic','da','hra','other')or coalesce(value,'')!~'^[0-9]+$')then raise exception 'Invalid salary components'using errcode='P0051';end if;
 if exists(select 1 from jsonb_each_text(p->'amounts')v where value::numeric>9000000000000)then raise exception 'Invalid salary components'using errcode='P0051';end if;
 p:=p||jsonb_build_object('amounts',jsonb_build_object('basic',p#>'{amounts,basic}','da',coalesce(p#>'{amounts,da}','0'),'hra',coalesce(p#>'{amounts,hra}','0'),'other',coalesce(p#>'{amounts,other}','0')));
 if p#>>'{salaryReference,grossMinor}'is null then p:=p||jsonb_build_object('salaryReference',coalesce(p->'salaryReference','{}')||jsonb_build_object('grossMinor',(select sum(value::bigint)from jsonb_each_text(p->'amounts'))));end if;
 end if;
 if(select count(*)from public.employees where company_id=c and upper(trim(employee_code))=upper(trim(p->>'employeeCode')))>1 then raise exception 'Employee Code is ambiguous; correct duplicate codes first.'using errcode='P0051';end if;
 select * into old_emp from public.employees where company_id=c and upper(trim(employee_code))=upper(trim(p->>'employeeCode'))for update;
 if old_emp.id is not null then
 if not coalesce(update_existing,false)then raise exception 'Employee exists; enable reviewed updates.'using errcode='P0051';end if;
 if coalesce((expected_versions->>upper(trim(p->>'employeeCode')))::integer,-1)<>old_emp.version then raise exception 'Employee changed; validate the file again'using errcode='40001';end if;
 p:=p||jsonb_build_object('employeeCode',old_emp.employee_code);
 p:=p||jsonb_build_object('phone',coalesce(nullif(p->>'phone',''),old_emp.phone,''),'department',coalesce(nullif(p->>'department',''),(select name from public.departments where company_id=c and id=old_emp.department_id),''),'designation',coalesce(nullif(p->>'designation',''),(select name from public.designations where company_id=c and id=old_emp.designation_id),''),'workLocation',coalesce(nullif(p->>'workLocation',''),old_emp.work_location,''),'state',coalesce(nullif(p->>'state',''),old_emp.state,''),'counterCode',coalesce(nullif(p->>'counterCode',''),old_emp.counter_code,''),'counterName',coalesce(nullif(p->>'counterName',''),old_emp.counter_name,''),'accountNumber',coalesce(nullif(p->>'accountNumber',''),(select account_number from public.employee_bank_details where company_id=c and employee_id=old_emp.id),''),'ifscCode',coalesce(nullif(p->>'ifscCode',''),(select ifsc_code from public.employee_bank_details where company_id=c and employee_id=old_emp.id),''),'pan',coalesce(nullif(p->>'pan',''),(select pan from public.employee_statutory_details where company_id=c and employee_id=old_emp.id),''),'uan',coalesce(nullif(p->>'uan',''),(select uan from public.employee_statutory_details where company_id=c and employee_id=old_emp.id),''),'esicNumber',coalesce(nullif(p->>'esicNumber',''),(select esic_number from public.employee_statutory_details where company_id=c and employee_id=old_emp.id),''));
 if p->>'statusProvided'='false' then p:=p||jsonb_build_object('clientStatus',coalesce(old_emp.client_status,case when old_emp.status='Exited'then 'Left'else 'Active'end),'exitDate',coalesce(old_emp.exit_date::text,''));end if;
 end if;
 employee_name:=regexp_replace(trim(p->>'employeeName'),'[[:space:]]+',' ','g');first_name_text:=split_part(employee_name,' ',1);last_name_text:=case when strpos(employee_name,' ')>0 then substr(employee_name,strpos(employee_name,' ')+1)else ''end;
 if p->>'clientStatus'not in('Active','Left','Rejoined')or(p->>'clientStatus'='Left'and(nullif(p->>'exitDate','')is null or(p->>'exitDate')::date>local_today))or(p->>'clientStatus'<>'Left'and nullif(p->>'exitDate','')is not null)then raise exception 'Invalid client employment status or leaving date'using errcode='22023';end if;
 eid:=public.save_employee(c,jsonb_build_object('employeeCode',p->>'employeeCode','firstName',first_name_text,'lastName',last_name_text,'email',coalesce(old_emp.email,''),'phone',p->>'phone','joiningDate',p->>'joiningDate','department',p->>'department','designation',p->>'designation','workLocation',p->>'workLocation','state',p->>'state','counterCode',p->>'counterCode','counterName',p->>'counterName','bankDetails',jsonb_build_object('accountHolderName',coalesce(nullif((select account_holder_name from public.employee_bank_details where company_id=c and employee_id=old_emp.id),''),employee_name),'accountNumber',p->>'accountNumber','ifscCode',p->>'ifscCode','bankName',coalesce((select bank_name from public.employee_bank_details where company_id=c and employee_id=old_emp.id),''),'branch',coalesce((select branch from public.employee_bank_details where company_id=c and employee_id=old_emp.id),'')),'statutory',jsonb_build_object('pan',p->>'pan','uan',p->>'uan','esicNumber',p->>'esicNumber')),old_emp.id,old_emp.version);
 update public.employees set client_status=p->>'clientStatus',status=case when old_emp.id is not null and p->>'statusProvided'='false'then old_emp.status when p->>'clientStatus'='Left'then 'Exited'else 'Active'end,exit_date=nullif(p->>'exitDate','')::date where company_id=c and id=eid;
 select version into v from public.employees where company_id=c and id=eid;
 insert into public.employee_private_details(company_id,employee_id,date_of_birth,gender,marital_status,aadhaar_number)values(c,eid,nullif(p->>'dateOfBirth','')::date,nullif(p->>'gender',''),coalesce(p->>'maritalStatus',''),coalesce(p->>'aadhaar',''))on conflict(company_id,employee_id)do update set date_of_birth=coalesce(excluded.date_of_birth,employee_private_details.date_of_birth),gender=coalesce(excluded.gender,employee_private_details.gender),marital_status=coalesce(nullif(excluded.marital_status,''),employee_private_details.marital_status),aadhaar_number=coalesce(nullif(excluded.aadhaar_number,''),employee_private_details.aadhaar_number);
 update public.employees set version=version+1,updated_at=now()where company_id=c and id=eid;
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
 insert into public.employee_client_salary_references(company_id,employee_id,gross_minor,pf_minor,esi_minor,ctc_minor,recorded_by)values(c,eid,(p#>>'{salaryReference,grossMinor}')::bigint,(p#>>'{salaryReference,pfMinor}')::bigint,(p#>>'{salaryReference,esiMinor}')::bigint,(p#>>'{salaryReference,ctcMinor}')::bigint,auth.uid())on conflict(company_id,employee_id)do update set gross_minor=coalesce(excluded.gross_minor,employee_client_salary_references.gross_minor),pf_minor=coalesce(excluded.pf_minor,employee_client_salary_references.pf_minor),esi_minor=coalesce(excluded.esi_minor,employee_client_salary_references.esi_minor),ctc_minor=coalesce(excluded.ctc_minor,employee_client_salary_references.ctc_minor),recorded_by=excluded.recorded_by;
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


notify pgrst,'reload schema';
commit;
