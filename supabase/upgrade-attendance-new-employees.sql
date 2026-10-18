-- Apply once after 043. Creates new employees only when explicitly supplied
-- with reviewed names/joining dates. Attendance and employee creation are atomic.
begin;
create function public.import_attendance_with_employees(c uuid,rows_json jsonb,new_employees jsonb,reason_text text)returns uuid
language plpgsql security definer set search_path=''as $$
declare p jsonb;row_data jsonb;eid uuid;employee_name text;first_name_text text;last_name_text text;
 mapping jsonb:='{}';resolved jsonb:='[]';bid uuid;
begin
 perform public.require_permission(c,'attendance.write');
 perform 1 from public.companies where id=c for update;
 perform public.require_permission(c,'attendance.write');perform public.require_permission(c,'employees.write');
 if rows_json is null or jsonb_typeof(rows_json)<>'array'or jsonb_array_length(rows_json)not between 1 and 1000
 or new_employees is null or jsonb_typeof(new_employees)<>'array'or jsonb_array_length(new_employees)not between 1 and 500
 or octet_length(rows_json::text)+octet_length(new_employees::text)>1000000 then
  raise exception 'Invalid attendance import size'using errcode='22023';
 end if;
 for p in select value from jsonb_array_elements(new_employees)loop
  if coalesce(p->>'employeeCode','')!~'^[A-Za-z0-9_-]{1,40}$'or mapping?(p->>'employeeCode')then
   raise exception 'Invalid or duplicate new employee code'using errcode='22023';end if;
  if not exists(select 1 from jsonb_array_elements(rows_json)entry where entry->>'employeeId'=p->>'employeeCode')then
   raise exception 'New employee must have attendance in this file'using errcode='22023';end if;
  if exists(select 1 from public.employees where company_id=c and employee_code=p->>'employeeCode')then
   raise exception 'Employee code now exists; refresh and validate the import again'using errcode='40001';end if;
  employee_name:=regexp_replace(trim(coalesce(p->>'employeeName','')),'[[:space:]]+',' ','g');
  first_name_text:=split_part(employee_name,' ',1);last_name_text:=case when strpos(employee_name,' ')>0 then substr(employee_name,strpos(employee_name,' ')+1)else ''end;
  if employee_name=''or length(first_name_text)>100 or length(last_name_text)>100
  or coalesce(p->>'joiningDate','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'then
   raise exception 'New employee name and actual joining date required'using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(rows_json)entry where entry->>'employeeId'=p->>'employeeCode'and(entry->>'date')::date<(p->>'joiningDate')::date)then
   raise exception 'Attendance precedes the new employee joining date'using errcode='22023';end if;
  eid:=public.save_employee(c,jsonb_build_object('employeeCode',p->>'employeeCode','firstName',first_name_text,'lastName',last_name_text,
   'joiningDate',p->>'joiningDate','email','','phone','','department',coalesce(p->>'department',''),'designation','',
   'workLocation',coalesce(p->>'workLocation',''),'state',coalesce(p->>'state',''),'counterCode',coalesce(p->>'counterCode',''),'counterName',coalesce(p->>'counterName','')));
  mapping:=mapping||jsonb_build_object(p->>'employeeCode',eid);
  perform public.audit_event(c,'Employee Created From Attendance','employee',eid,jsonb_build_object('joiningDate',p->>'joiningDate'));
 end loop;
 for row_data in select value from jsonb_array_elements(rows_json)loop
  if mapping?(row_data->>'employeeId')then row_data:=jsonb_set(row_data,'{employeeId}',mapping->(row_data->>'employeeId'));end if;
  resolved:=resolved||jsonb_build_array(row_data);
 end loop;
 bid:=public.import_attendance(c,resolved,reason_text);
 perform public.audit_event(c,'Attendance New Employees Imported','attendance_import',bid,jsonb_build_object('newEmployees',jsonb_array_length(new_employees)));
 return bid;
end $$;
revoke all on function public.import_attendance_with_employees(uuid,jsonb,jsonb,text)from public,anon,authenticated;
grant execute on function public.import_attendance_with_employees(uuid,jsonb,jsonb,text)to authenticated;
commit;
