-- Apply once after 048. Existing financial history is retained. No employee
-- is considered an imported master until their actual Employee Database is uploaded.
begin;
create unique index employees_normalized_code on public.employees(company_id,upper(trim(employee_code)));
alter table public.employees add column master_imported boolean not null default false,add column master_revision_id uuid;
create table public.employee_master_revisions(
 id uuid primary key default gen_random_uuid(),revision_no bigint generated always as identity,company_id uuid not null,employee_id uuid not null,assignment_id uuid not null,
 source_data jsonb not null,recorded_by uuid not null references public.user_profiles(id),created_at timestamptz not null default now(),
 unique(company_id,id),foreign key(company_id,employee_id)references public.employees(company_id,id),foreign key(company_id,assignment_id)references public.employee_salary_assignments(company_id,id)
);
alter table public.employee_master_revisions enable row level security;
revoke all on public.employee_master_revisions from public,anon,authenticated;
grant select on public.employee_master_revisions to authenticated;
create policy imported_master_read on public.employee_master_revisions for select to authenticated using(public.has_permission(company_id,'salary.read')and public.has_permission(company_id,'employees.sensitive'));
alter table public.employees add foreign key(company_id,master_revision_id)references public.employee_master_revisions(company_id,id);
alter table public.employee_salary_assignments add column master_source_id uuid,add foreign key(company_id,master_source_id)references public.employee_master_revisions(company_id,id);
create index imported_salary_history on public.employee_master_revisions(company_id,employee_id,revision_no desc);
-- Retain archived preset records only for historical foreign keys. No active defaults.
update public.salary_structures set status='Archived'where(company_id,id)in(select company_id,structure_id from public.designation_salary_presets);
update public.designation_salary_presets set active=false;
revoke all on public.designation_salary_presets from anon,authenticated;
create or replace function public.seed_designation_presets_internal(c uuid)returns void language plpgsql set search_path=''as $$begin return;end $$;
create or replace function public.seed_legacy_designation_presets_internal(c uuid)returns void language plpgsql set search_path=''as $$begin return;end $$;
create or replace function public.save_employee(c uuid,p jsonb,employee_uuid uuid default null,expected_version integer default null)returns uuid language plpgsql set search_path=''as $$begin raise exception 'Upload the Employee Database to create or update employee master data.'using errcode='P0049';end $$;
-- Disable retired public and private preset/independent-salary entry points.
revoke execute on function public.initialize_designation_presets(uuid),public.save_designation_salary_preset(uuid,uuid,integer,text,jsonb,boolean),public.apply_designation_salaries(uuid),public.use_employee_designation_salary(uuid,uuid,date,integer),public.assign_designation_salary_private(uuid,uuid,uuid,date,jsonb,text),public.apply_designation_salary_internal(uuid,uuid,boolean,date),public.list_department_designations(uuid),public.list_designation_salary_names(uuid)from public,anon,authenticated;
create or replace function public.assign_salary(c uuid,e uuid,s uuid,effective date,amounts jsonb,remarks_text text default '')returns uuid language plpgsql set search_path=''as $$begin raise exception 'Salary components must come from Employee Database upload.'using errcode='P0049';end $$;
revoke execute on function public.save_salary_structure(uuid,jsonb,uuid,integer)from public,anon,authenticated;
create function public.import_employee_master(c uuid,rows_json jsonb,update_existing boolean default false,expected_versions jsonb default '{}')returns uuid language plpgsql security definer set search_path=''as $$
declare p jsonb;eid uuid;sid uuid;batch uuid;employee_name text;first_name_text text;last_name_text text;v integer;manager uuid;matches integer;local_today date;old_emp public.employees;prior public.employee_master_revisions;aid uuid;revision_id uuid;total numeric;current_amounts jsonb;new_payload jsonb;
begin
 perform public.require_permission(c,'employees.write');perform public.require_permission(c,'employees.sensitive');perform 1 from public.companies where id=c for update;
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 500 or octet_length(rows_json::text)>1000000 then raise exception 'Invalid client employee import size'using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(rows_json)entry(value) where entry.value->'amounts'<>'null'::jsonb or entry.value#>>'{salaryReference,grossMinor}'is not null or entry.value#>>'{salaryReference,pfMinor}'is not null or entry.value#>>'{salaryReference,esiMinor}'is not null or entry.value#>>'{salaryReference,ctcMinor}'is not null)then perform public.require_permission(c,'salary.write');end if;
 perform public.require_permission(c,'salary.write');
 if(select count(distinct upper(trim(value->>'employeeCode')))from jsonb_array_elements(rows_json))<>jsonb_array_length(rows_json)then raise exception 'Duplicate employee codes in file'using errcode='P0049';end if;
 select(now()at time zone timezone)::date into local_today from public.companies where id=c;
 for p in select value from jsonb_array_elements(rows_json)loop
 prior:=null;old_emp:=null;
 p:=p||jsonb_build_object('employeeCode',upper(trim(p->>'employeeCode')));
 if coalesce(p->>'employeeCode','')!~'^[A-Z0-9_-]{1,40}$'or nullif(trim(p->>'employeeName'),'')is null or jsonb_typeof(p->'amounts')is distinct from 'object' or (select count(*)from jsonb_object_keys(p->'amounts'))<>4 then raise exception 'Complete salary components required'using errcode='P0049';end if;
 total:=0;
 foreach employee_name in array array['basic','da','hra','other']loop
 if coalesce(p#>>array['amounts',employee_name],'')!~'^[0-9]+$'or(p#>>array['amounts',employee_name])::numeric>9000000000000 then raise exception 'Complete salary components required'using errcode='P0049';end if;
 total:=total+(p#>>array['amounts',employee_name])::numeric;end loop;
 foreach employee_name in array array['grossMinor','pfMinor','esiMinor','ctcMinor']loop
 if coalesce(p#>>array['salaryReference',employee_name],'')!~'^[0-9]+$'or(p#>>array['salaryReference',employee_name])::numeric>9000000000000 then raise exception 'Complete salary reference values required'using errcode='P0049';end if;end loop;
 if total<> (p#>>'{salaryReference,grossMinor}')::numeric then raise exception 'Structured gross does not match components'using errcode='23514';end if;
 select * into old_emp from public.employees where company_id=c and upper(trim(employee_code))=p->>'employeeCode'for update;
 if old_emp.id is not null then
 if not update_existing then raise exception 'Employee exists; choose reviewed update mode'using errcode='P0049';end if;
 if coalesce((expected_versions->>(p->>'employeeCode'))::integer,-1)<>old_emp.version then raise exception 'Employee changed; validate the file again'using errcode='40001';end if;
 select * into prior from public.employee_master_revisions where company_id=c and employee_id=old_emp.id order by revision_no desc limit 1;
 if prior.source_data=p then continue;end if;
 end if;
 employee_name:=regexp_replace(trim(p->>'employeeName'),'[[:space:]]+',' ','g');first_name_text:=split_part(employee_name,' ',1);last_name_text:=case when strpos(employee_name,' ')>0 then substr(employee_name,strpos(employee_name,' ')+1)else ''end;
 if p->>'clientStatus'not in('Active','Left','Rejoined')or(p->>'clientStatus'='Left'and(nullif(p->>'exitDate','')is null or(p->>'exitDate')::date>local_today))or(p->>'clientStatus'<>'Left'and nullif(p->>'exitDate','')is not null)then raise exception 'Invalid client employment status or leaving date'using errcode='22023';end if;
 eid:=public.save_employee_before_designation(c,jsonb_build_object('employeeCode',p->>'employeeCode','firstName',first_name_text,'lastName',last_name_text,'email','','phone',p->>'phone','joiningDate',p->>'joiningDate','department',p->>'department','designation',p->>'designation','workLocation',p->>'workLocation','state',p->>'state','counterCode',p->>'counterCode','counterName',p->>'counterName','bankDetails',jsonb_build_object('accountHolderName',employee_name,'accountNumber',p->>'accountNumber','ifscCode',p->>'ifscCode'),'statutory',jsonb_build_object('pan',p->>'pan','uan',p->>'uan','esicNumber',p->>'esicNumber')) ,old_emp.id,old_emp.version);
 update public.employees set client_status=p->>'clientStatus',status=case when p->>'clientStatus'='Left'then 'Exited'else 'Active'end,exit_date=nullif(p->>'exitDate','')::date where company_id=c and id=eid;
 select version into v from public.employees where company_id=c and id=eid;
 perform public.save_employee_personal(c,eid,v,jsonb_build_object('dateOfBirth',p->>'dateOfBirth','gender',p->>'gender','maritalStatus',p->>'maritalStatus'));
 update public.employee_private_details set aadhaar_number=coalesce(p->>'aadhaar','')where company_id=c and employee_id=eid;
 if p->'amounts'<>'null'::jsonb then
  if nullif(p->>'salaryEffectiveFrom','')is null or(p->>'salaryEffectiveFrom')::date<(p->>'joiningDate')::date or(nullif(p->>'exitDate','')is not null and(p->>'salaryEffectiveFrom')::date>(p->>'exitDate')::date) then raise exception 'Reviewed salary effective date required'using errcode='22023';end if;
  select id into sid from public.salary_structures where company_id=c and name='Employee Database contractual components'and status='Active';
  if sid is null then
   insert into public.salary_structures(company_id,name,status)values(c,'Employee Database contractual components','Active')returning id into sid;
   insert into public.salary_structure_components(company_id,structure_id,component_code,calculation_type)select c,sid,code,'Uploaded amount'from unnest(array['basic','da','hra','other'])code;
  end if;
  aid:=null;
  if prior.id is not null and prior.source_data->'amounts'=p->'amounts'and prior.source_data->'salaryReference'=p->'salaryReference'then aid:=prior.assignment_id;end if;
  if aid is null then
   if exists(select 1 from public.employee_salary_assignments where company_id=c and employee_id=eid and effective_from=(p->>'salaryEffectiveFrom')::date)then raise exception 'Salary effective date already exists; choose a new reviewed revision date. No rows were imported.'using errcode='P0049';end if;
   aid:=public.assign_salary_before_designation(c,eid,sid,(p->>'salaryEffectiveFrom')::date,p->'amounts','Authoritative Employee Database import');
  end if;
  insert into public.employee_master_revisions(company_id,employee_id,assignment_id,source_data,recorded_by)values(c,eid,aid,p,auth.uid())returning id into revision_id;
  update public.employee_salary_assignments set master_source_id=coalesce(master_source_id,revision_id)where company_id=c and id=aid;
  update public.employees set master_imported=true,master_revision_id=revision_id,salary_mode='custom'where company_id=c and id=eid;
 end if;
 insert into public.employee_client_salary_references(company_id,employee_id,gross_minor,pf_minor,esi_minor,ctc_minor,recorded_by)values(c,eid,(p#>>'{salaryReference,grossMinor}')::bigint,(p#>>'{salaryReference,pfMinor}')::bigint,(p#>>'{salaryReference,esiMinor}')::bigint,(p#>>'{salaryReference,ctcMinor}')::bigint,auth.uid())on conflict(company_id,employee_id)do update set gross_minor=excluded.gross_minor,pf_minor=excluded.pf_minor,esi_minor=excluded.esi_minor,ctc_minor=excluded.ctc_minor,recorded_by=excluded.recorded_by;
 perform public.audit_event(c,'Client Employee Imported','employee',eid,jsonb_build_object('clientStatus',p->>'clientStatus','salaryAssigned',p->'amounts'<>'null'::jsonb));
 end loop;
 -- Resolve managers after all employees exist; the normal cycle check remains active.
 for p in select value from jsonb_array_elements(rows_json)loop
 select id,version into eid,v from public.employees where company_id=c and upper(trim(employee_code))=upper(trim(p->>'employeeCode'));
 manager:=null;
 if nullif(trim(p->>'reportingManager'),'')is not null then
 select count(*),(array_agg(id))[1]into matches,manager from public.employees where company_id=c and status not in('Exited','Inactive')and(upper(trim(employee_code))=upper(trim(p->>'reportingManager'))or lower(trim(first_name||' '||last_name))=lower(trim(p->>'reportingManager')));
 if matches<>1 then raise exception 'Reporting manager must uniquely match an active company employee code or full name'using errcode='22023';end if;
 end if;
 if (select manager_id from public.employees where company_id=c and id=eid)is distinct from manager then perform public.set_employee_manager(c,eid,manager,v);end if;
 end loop;
 insert into public.employee_import_batches(company_id,actor_id,row_count)values(c,auth.uid(),jsonb_array_length(rows_json))returning id into batch;
 perform public.audit_event(c,'Client Employee Batch Imported','employee_import',batch,jsonb_build_object('rows',jsonb_array_length(rows_json)));return batch;
end $$;

revoke all on function public.import_employee_master(uuid,jsonb,boolean,jsonb)from public,anon,authenticated;
grant execute on function public.import_employee_master(uuid,jsonb,boolean,jsonb)to authenticated;

create or replace function public.import_attendance_with_employees(c uuid,rows_json jsonb,new_employees jsonb,reason_text text)returns uuid language plpgsql set search_path=''as $$begin raise exception 'Import Employee Database first. Attendance cannot create employees.'using errcode='P0049';end $$;
alter function public.save_attendance(uuid,jsonb,text,boolean)rename to save_attendance_before_master;
revoke all on function public.save_attendance_before_master(uuid,jsonb,text,boolean)from public,anon,authenticated;
create function public.save_attendance(c uuid,rows_json jsonb,reason_text text,allow_update boolean default true)returns integer language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'attendance.write');perform 1 from public.companies where id=c for update;
 if exists(select 1 from jsonb_array_elements(rows_json)r where not exists(select 1 from public.employees e where e.company_id=c and e.id=(r->>'employeeId')::uuid and e.master_imported))then raise exception 'Import Employee Database first. Attendance employee has no imported master.'using errcode='P0049';end if;
 return public.save_attendance_before_master(c,rows_json,reason_text,allow_update);
end $$;
revoke all on function public.save_attendance(uuid,jsonb,text,boolean)from public,anon,authenticated;
grant execute on function public.save_attendance(uuid,jsonb,text,boolean)to authenticated;
create or replace function public.salary_assignment_at(c uuid,e uuid,d date)returns uuid language sql stable set search_path=''as $$
 select a.id from public.employee_salary_assignments a where a.company_id=c and a.employee_id=e and a.master_source_id is not null
 order by(a.effective_from<=d)desc,case when a.effective_from<=d then a.effective_from end desc,a.effective_from,a.id limit 1
$$;
alter table public.attendance_import_batches add unique(company_id,id);
create table public.attendance_master_matches(
 company_id uuid not null,batch_id uuid not null,employee_id uuid not null,date date not null,
 primary key(company_id,batch_id,employee_id,date),foreign key(company_id,batch_id)references public.attendance_import_batches(company_id,id),foreign key(company_id,employee_id)references public.employees(company_id,id)
);
alter table public.attendance_master_matches enable row level security;
revoke all on public.attendance_master_matches from public,anon,authenticated;
grant select on public.attendance_master_matches to authenticated;
create policy attendance_master_match_read on public.attendance_master_matches for select to authenticated using(public.has_permission(company_id,'attendance.read'));
alter function public.import_attendance(uuid,jsonb,text)rename to import_attendance_before_master;
revoke all on function public.import_attendance_before_master(uuid,jsonb,text)from public,anon,authenticated;
create function public.import_attendance(c uuid,rows_json jsonb,reason_text text)returns uuid language plpgsql security definer set search_path=''as $$declare batch uuid;begin
 batch:=public.import_attendance_before_master(c,rows_json,reason_text);
 insert into public.attendance_master_matches(company_id,batch_id,employee_id,date)select c,batch,(r->>'employeeId')::uuid,(r->>'date')::date from jsonb_array_elements(rows_json)r;
 return batch;
end $$;
revoke all on function public.import_attendance(uuid,jsonb,text)from public,anon,authenticated;
grant execute on function public.import_attendance(uuid,jsonb,text)to authenticated;
alter function public.validate_payroll(uuid,date)rename to validate_payroll_before_master;
revoke all on function public.validate_payroll_before_master(uuid,date)from public,anon,authenticated;
create function public.validate_payroll(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$
declare checks jsonb;issues jsonb;e record;blocking integer;begin
 checks:=public.validate_payroll_before_master(c,m);issues:=coalesce(checks->'issues','[]');
 for e in select id from public.employees where company_id=c and joining_date<=(m+interval '1 month - 1 day')::date and(exit_date is null or exit_date>=m)and status not in('Inactive','Salary Hold')loop
 if not exists(select 1 from public.employees where company_id=c and id=e.id and master_imported)or public.salary_assignment_at(c,e.id,m)is null then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',e.id,'check','Employee Database','severity','Blocking Error','message','Upload this employee and complete salary components through Employee Database. Role presets and legacy/manual salaries cannot be used.'));end if;
 if not exists(select 1 from public.attendance_master_matches where company_id=c and employee_id=e.id and date between m and(m+interval '1 month - 1 day')::date)then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId',e.id,'check','Attendance Upload','severity','Blocking Error','message','This employee is missing from the reconciled attendance uploads for this month.'));end if;
 end loop;
 if not exists(select 1 from public.employees where company_id=c and master_imported)then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId','','check','Employee Database','severity','Blocking Error','message','Upload the Employee Database before generating payroll.'));end if;
 if not exists(select 1 from public.attendance_master_matches where company_id=c and date between m and(m+interval '1 month - 1 day')::date)then issues:=issues||jsonb_build_array(jsonb_build_object('employeeId','','check','Attendance Upload','severity','Blocking Error','message','Upload and reconcile attendance for this month after importing Employee Database.'));end if;
 select count(*)into blocking from jsonb_array_elements(issues)i where i->>'severity'='Blocking Error';
 return checks||jsonb_build_object('issues',issues,'blockingErrors',blocking,'passed',case when blocking=0 then(checks->>'totalChecked')::integer else 0 end);
end $$;
revoke all on function public.validate_payroll(uuid,date)from public,anon,authenticated;
grant execute on function public.validate_payroll(uuid,date)to authenticated;

create function public.master_payroll_snapshot(c uuid,e uuid,m date)returns jsonb language plpgsql stable set search_path=''as $$
declare source jsonb;contract jsonb;contracts jsonb;revision uuid;begin
 select r.source_data,r.id into source,revision from public.employees emp join public.employee_master_revisions r on r.company_id=c and r.id=emp.master_revision_id where emp.company_id=c and emp.id=e;
 select r.source_data into contract from public.employee_salary_assignments a join public.employee_master_revisions r on r.company_id=c and r.id=a.master_source_id where a.company_id=c and a.id=public.salary_assignment_at(c,e,(m+interval '1 month - 1 day')::date);
 select coalesce(jsonb_agg(jsonb_build_object('revisionId',r.id,'effectiveFrom',a.effective_from,'amounts',r.source_data->'amounts','references',r.source_data->'salaryReference')order by a.effective_from),'[]'::jsonb)into contracts from public.employee_salary_assignments a join public.employee_master_revisions r on r.company_id=c and r.id=a.master_source_id where a.company_id=c and a.employee_id=e and a.master_source_id is not null and(a.effective_from<=(m+interval '1 month - 1 day')::date or a.id=public.salary_assignment_at(c,e,m));
 return jsonb_build_object('masterRevisionId',revision,'identity',jsonb_build_object('designation',source->>'designation','location',source->>'workLocation','state',source->>'state','joiningDate',source->>'joiningDate','exitDate',source->>'exitDate'),'contractual',contract->'amounts'||jsonb_build_object('references',contract->'salaryReference'),'contracts',contracts);
end $$;
revoke all on function public.master_payroll_snapshot(uuid,uuid,date)from public,anon,authenticated;
do $$declare definition text;changed text;begin
 definition:=pg_get_functiondef('public.calculate_payroll(uuid,date)'::regprocedure);
 changed:=replace(definition,'''salary'',salary_snapshot,''attendance'',attendance_snapshot','''salary'',salary_snapshot,''employeeMaster'',public.master_payroll_snapshot(c,emp.id,m),''attendance'',attendance_snapshot');
 if changed=definition then raise exception 'Salary snapshot anchor missing';end if;
 changed:=replace(changed,'''exact-proration-v3-salary-carry''','''employee-master-v4''');execute changed;
 definition:=pg_get_functiondef('public.protect_payroll_calculation_method()'::regprocedure);
 changed:=replace(definition,'''exact-proration-v3-salary-carry''','''employee-master-v4''');execute changed;
end $$;
alter function public.bulk_update_employees(uuid,uuid[],text,jsonb)rename to bulk_update_employees_before_master;
revoke all on function public.bulk_update_employees_before_master(uuid,uuid[],text,jsonb)from public,anon,authenticated;
create function public.bulk_update_employees(c uuid,employee_ids uuid[],field_name text,field_value jsonb)returns void language plpgsql security definer set search_path=''as $$begin
 perform public.require_permission(c,'employees.write');
 if field_name in('department','workLocation','state')then raise exception 'Update employee master fields through Employee Database upload.'using errcode='P0049';end if;
 perform public.bulk_update_employees_before_master(c,employee_ids,field_name,field_value);
end $$;
revoke all on function public.bulk_update_employees(uuid,uuid[],text,jsonb)from public,anon,authenticated;
grant execute on function public.bulk_update_employees(uuid,uuid[],text,jsonb)to authenticated;
create function public.payroll_master_reconciliation(c uuid,m date)returns jsonb language plpgsql security definer set search_path=''as $$
declare rows jsonb;finish date:=(m+interval '1 month - 1 day')::date;begin
 perform public.require_permission(c,'payroll.run');
 if m is null or extract(day from m)<>1 then raise exception 'First day required'using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(summary)order by summary."employeeCode"),'[]'::jsonb)into rows from(
 select e.id "employeeId",e.employee_code "employeeCode",trim(e.first_name||' '||e.last_name)"employeeName",e.master_imported "masterImported",greatest(m,e.joining_date)"fromDate",least(finish,coalesce(e.exit_date,finish))"toDate",
 (least(finish,coalesce(e.exit_date,finish))-greatest(m,e.joining_date)+1)"expectedDays",
 (select count(*)from public.attendance_records a where a.company_id=c and a.employee_id=e.id and a.date between greatest(m,e.joining_date)and least(finish,coalesce(e.exit_date,finish)))"recordedDays",
 (select count(*)from public.attendance_records a where a.company_id=c and a.employee_id=e.id and a.date between greatest(m,e.joining_date)and least(finish,coalesce(e.exit_date,finish))and a.status='Missing Punch')"missingPunchDays",
 exists(select 1 from public.attendance_master_matches a where a.company_id=c and a.employee_id=e.id and a.date between m and finish)"matchedUpload",
 (public.salary_assignment_at(c,e.id,least(finish,coalesce(e.exit_date,finish)))is not null)"salaryImported"
 from public.employees e where e.company_id=c and e.joining_date<=finish and(e.exit_date is null or e.exit_date>=m)and e.status not in('Inactive','Salary Hold')
 )summary;
 return jsonb_build_object('totalEmployees',(select count(*)from public.employees where company_id=c),'importedEmployees',(select count(*)from public.employees where company_id=c and master_imported),'rows',rows);
end $$;
revoke all on function public.payroll_master_reconciliation(uuid,date)from public,anon,authenticated;
grant execute on function public.payroll_master_reconciliation(uuid,date)to authenticated;
create function public.reconcile_saved_master_attendance(c uuid,m date,reason_text text)returns integer language plpgsql security definer set search_path=''as $$declare batch uuid;n integer;begin
 perform public.require_permission(c,'payroll.run');perform public.require_permission(c,'attendance.write');perform 1 from public.companies where id=c for update;
 if m is null or extract(day from m)<>1 or length(trim(coalesce(reason_text,'')))not between 1 and 1000 then raise exception 'Review the month and reconciliation reason'using errcode='22023';end if;
 if exists(select 1 from public.attendance_records a join public.employees e on e.company_id=c and e.id=a.employee_id where a.company_id=c and a.source='CSV'and a.date between m and(m+interval '1 month - 1 day')::date and not e.master_imported)then raise exception 'Import Employee Database for the saved attendance employees before matching.'using errcode='P0049';end if;
 select count(*)into n from public.attendance_records a where a.company_id=c and a.source='CSV'and a.date between m and(m+interval '1 month - 1 day')::date and not exists(select 1 from public.attendance_master_matches match where match.company_id=c and match.employee_id=a.employee_id and match.date=a.date);
 if n=0 then return 0;end if;
 insert into public.attendance_import_batches(company_id,actor_id,row_count)values(c,auth.uid(),n)returning id into batch;
 insert into public.attendance_master_matches(company_id,batch_id,employee_id,date)select c,batch,a.employee_id,a.date from public.attendance_records a where a.company_id=c and a.source='CSV'and a.date between m and(m+interval '1 month - 1 day')::date and not exists(select 1 from public.attendance_master_matches match where match.company_id=c and match.employee_id=a.employee_id and match.date=a.date);
 perform public.audit_event(c,'Saved Attendance Matched','attendance_import',batch,jsonb_build_object('month',m,'rows',n,'reason',reason_text));return n;
end $$;
revoke all on function public.reconcile_saved_master_attendance(uuid,date,text)from public,anon,authenticated;
grant execute on function public.reconcile_saved_master_attendance(uuid,date,text)to authenticated;
commit;
