import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,body, databaseError, endpoint, result } from '@/server/http';
const monthSchema=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-01$/);
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'payroll.run');
 const month=monthSchema.parse(new URL(request.url).searchParams.get('month'));
 const [run,attendance,workflow]=await Promise.all([
  client.from('payroll_runs').select('*').eq('company_id',companyId).eq('month',month).maybeSingle(),
  client.from('attendance_periods').select('finalized_at').eq('company_id',companyId).eq('month',month).maybeSingle(),
  client.rpc('payroll_workflow_status',{c:companyId,m:month})
 ]);databaseError(run.error);databaseError(attendance.error);
 const snapshots=[];
 if(run.data)for(let offset=0;;offset+=500){
  const page=await client.from('payroll_run_employees').select('*').eq('company_id',companyId).eq('run_id',run.data.id).order('employee_id').range(offset,offset+499);databaseError(page.error);
  snapshots.push(...(page.data??[]));if((page.data?.length??0)<500)break;
 }
 if(workflow.error&&!['PGRST202','42883'].includes(workflow.error.code))databaseError(workflow.error);
 return result({run:run.data,attendanceFinalized:!!attendance.data?.finalized_at,snapshots,workflow:workflow.error?null:workflow.data});
});
export const POST=endpoint(async request=>{
 const input=await body(request,z.object({month:monthSchema,action:z.enum(['validate','calculate','approve','lock','unlock']),expectedVersion:z.number().int().positive().optional(),reason:z.string().max(1000).default('')}).strict());
 const permission={validate:'payroll.run',calculate:'payroll.run',approve:'payroll.approve',lock:'payroll.lock',unlock:'payroll.unlock'}[input.action];
 const {client,companyId}=await tenant(request,permission);
 // Migration 039 installs the exact rounding implementation and its provenance
 // table atomically. Do not calculate or approve with the known older method.
 if(input.action==='calculate'||input.action==='approve'){
  const method=await client.from('payroll_calculation_methods').select('method').eq('company_id',companyId).limit(1);databaseError(method.error);
 }
 if(input.action==='validate'||input.action==='calculate'){
  if(input.action==='calculate'){
   const checks=await client.rpc('validate_payroll',{c:companyId,m:input.month});databaseError(checks.error);
   if(checks.data.blockingErrors>0)throw new ApiError(422,'PAYROLL_NOT_READY',`Payroll has ${checks.data.blockingErrors} blocking issue(s). ${checks.data.issues.filter((issue:{severity:string})=>issue.severity==='Blocking Error').slice(0,3).map((issue:{message:string})=>issue.message).join(' ')} Open Validate to review every issue.`);
  }
  const response=await client.rpc(input.action==='validate'?'validate_payroll':'calculate_payroll',{c:companyId,m:input.month});
  if(response.error?.code==='23514'&&response.error.message==='Payroll is approved or locked')throw new ApiError(409,'PAYROLL_LOCKED','Approved or locked payroll cannot be recalculated. Use the authorized correction workflow.');
  if(response.error?.code==='23514'&&response.error.message==='A configured statutory deduction needs a reviewed rule covering the month')throw new ApiError(422,'STATUTORY_RULE_REQUIRED','A deduction is marked applicable but has no reviewed rule for this month. Review Statutory Configuration in Settings, then calculate again.');
  if(response.error?.code==='23514'&&response.error.message==='Negative net payable; correct deductions before payroll')throw new ApiError(422,'NEGATIVE_NET_PAY','Deductions exceed an employee’s calculated gross pay. Review deductions and unpaid attendance before recalculating.');
  databaseError(response.error);return result(response.data);
 }
 const expectedVersion=z.number().int().positive().parse(input.expectedVersion);
 if(input.action==='unlock')z.string().trim().min(1).parse(input.reason);
 const response=await client.rpc('transition_payroll',{c:companyId,m:input.month,action_text:input.action,expected_version:expectedVersion,reason_text:input.reason});
 if(response.error?.code==='40001'&&response.error.message==='Payroll calculation method changed; recalculate before approval')throw new ApiError(409,'PAYROLL_RECALCULATE','Recalculate this unapproved payroll with the updated calculation method before approving it.');
 if(response.error?.code==='40001'&&response.error.message==='Payroll inputs changed; recalculate before approval')throw new ApiError(409,'PAYROLL_INPUTS_CHANGED','Salary, attendance or payroll configuration changed after calculation. Recalculate payroll before approving it.');
 if(response.error?.code==='23514'&&response.error.message==='Validation failed')throw new ApiError(422,'PAYROLL_NOT_READY','Payroll inputs no longer pass validation. Run Validate and resolve the listed issues before approval.');
 databaseError(response.error);return result({saved:true});
});
