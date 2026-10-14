import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError, databaseError, endpoint, result } from '@/server/http';
export const GET = endpoint(async request => {
  const { client, companyId } = await tenant(request);
  const id = z.string().uuid().parse(new URL(request.url).searchParams.get('id'));
  const employee = await client.from('employees').select('manager_id,id,employee_code,first_name,last_name,email,phone,status,joining_date,exit_date,work_location,state,category,employment_type,version,departments(name),designations(name)').eq('company_id',companyId).eq('id',id).maybeSingle();
  databaseError(employee.error);
  if (!employee.data) throw new ApiError(404,'NOT_FOUND','Employee not found.');
  const documents=await client.rpc('can_read_employee_document',{c:companyId,e:id});databaseError(documents.error);
  // RLS separately protects bank/statutory data. No privileged client is used.
  const responses = await Promise.all([
    client.from('employee_bank_details').select('account_holder_name,account_number,ifsc_code,bank_name,branch').eq('company_id',companyId).eq('employee_id',id).maybeSingle(),
    client.from('employee_statutory_details').select('pan,uan,esic_number,pf_applicable,esi_applicable,pt_applicable,tds_applicable').eq('company_id',companyId).eq('employee_id',id).maybeSingle(),
    client.from('employee_private_details').select('*').eq('company_id',companyId).eq('employee_id',id).maybeSingle(),
    client.from('employee_status_history').select('*').eq('company_id',companyId).eq('employee_id',id).order('created_at',{ascending:false}),
  ]);
  for (const response of responses) databaseError(response.error);
  return result({ employee:employee.data, canReadDocuments:documents.data===true, bank:responses[0].data, statutory:responses[1].data, personal:responses[2].data, history:responses[3].data });
});
