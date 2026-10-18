import 'server-only';
import { z } from 'zod';
import { tenant } from './auth';
import { ApiError, body, databaseError, endpoint, result } from './http';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date.');
export const employeeInput = z.object({
  employeeCode: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional(),
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().max(100),
  email: z.union([z.string().email().max(254),z.literal('')]), phone: z.string().max(30).optional(),
  joiningDate: date, department: z.string().trim().max(100).optional(), designation: z.string().trim().max(100).optional(),
  workLocation: z.string().max(160).optional(), state: z.string().max(100).optional(),
  employmentType: z.enum(['Full-time','Part-time','Contractor','Intern']).optional(),
  category: z.enum(['Permanent','Contract','Consultant','Intern','Temporary','Rent Candidate','Other']).optional(),
  counterCode:z.string().max(80).optional(),counterName:z.string().max(160).optional(),
  bankDetails: z.object({ accountHolderName: z.string().max(160), accountNumber: z.string().regex(/^([0-9]{6,34})?$/), ifscCode: z.string().regex(/^([A-Z]{4}0[A-Z0-9]{6})?$/), bankName: z.string().max(160), branch: z.string().max(160) }).strict().optional(),
  statutory: z.object({ aadhaar:z.string().regex(/^([0-9]{12})?$/).optional(),pan: z.string().regex(/^([A-Z]{5}[0-9]{4}[A-Z])?$/).optional(), uan: z.string().regex(/^([0-9]{12})?$/).optional(), esicNumber: z.string().max(30).optional() }).strict().optional(),
}).strict();
const selection = 'counter_code,counter_name,client_status,id,employee_code,first_name,last_name,email,phone,department_id,designation_id,status,joining_date,exit_date,work_location,state,category,employment_type,version,departments(name),designations(name)';
export const listEmployees = endpoint(async request => {
  // Employee/manager row visibility is enforced by can_read_employee RLS.
  const { client, companyId } = await tenant(request);
  const params = new URL(request.url).searchParams;
  const page = z.coerce.number().int().min(1).default(1).parse(params.get('page') ?? undefined);
  const size = z.coerce.number().int().min(1).max(100).default(25).parse(params.get('pageSize') ?? undefined);
  const read=(columns:string)=>{let query = client.from('employees').select(columns, { count: 'exact' }).eq('company_id', companyId).order('employee_code').range((page - 1) * size, page * size - 1);
  if (params.has('search')) {
    const search = z.string().max(100).parse(params.get('search')).replace(/[%_,().\\]/g, ' ').trim();
    if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_code.ilike.%${search}%`);
  }
  if (params.has('status')) query = query.eq('status', z.enum(['Active','Probation','On Notice','On Leave','Salary Hold','Inactive','Exited']).parse(params.get('status')));
  return query;};
  let response=await read(selection);if(response.error&&['42703','PGRST204'].includes(response.error.code))response=await read(selection.replace('counter_code,counter_name,client_status,',''));databaseError(response.error);
  return result({ items: response.data, total: response.count, page, pageSize: size });
});
export const saveEmployee = endpoint(async request => {
  const { client, companyId } = await tenant(request, 'employees.write');
  const input = await body(request, z.object({ employee: employeeInput, id: z.string().uuid().optional(), expectedVersion: z.number().int().positive().optional() }).strict());
  if (input.id && !input.expectedVersion) throw new ApiError(422, 'VERSION_REQUIRED', 'Supply the current employee version when editing.');
  if(input.employee.counterCode||input.employee.counterName||input.employee.statutory?.aadhaar||!input.employee.email||!input.employee.lastName){const feature=await client.from('employees').select('counter_code').eq('company_id',companyId).limit(1);databaseError(feature.error);}
  const response = await client.rpc('save_employee', { c: companyId, p: input.employee, employee_uuid: input.id ?? null, expected_version: input.expectedVersion ?? null });
  databaseError(response.error);
  return result({ id: response.data }, input.id ? 200 : 201);
});
export const changeStatus = endpoint(async request => {
  const { client, companyId } = await tenant(request, 'employees.write');
  const input = await body(request, z.object({ id: z.string().uuid(),expectedVersion:z.number().int().positive(), status: z.enum(['Active','Probation','On Notice','On Leave','Salary Hold','Inactive','Exited']), effectiveDate: date, reason: z.string().trim().min(1).max(1000), remarks: z.string().max(1000).default(''),exit:z.object({lastWorkingDate:date,exitType:z.enum(['Resignation','Termination','Retirement','Contract Completed','Absconding','Other']),settlementStatus:z.enum(['Not Started','In Progress','Completed'])}).strict().optional() }).strict());
  const response = await client.rpc('change_employment_status', { c: companyId, e: input.id, next_status: input.status, effective: input.effectiveDate, reason_text: input.reason, remarks_text: input.remarks,expected_version:input.expectedVersion,exit_json:input.exit??null });
  databaseError(response.error); return result({ updated: true });
});
