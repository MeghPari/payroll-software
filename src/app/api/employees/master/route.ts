import {tenant} from '@/server/auth';
import {ApiError,databaseError,endpoint,result} from '@/server/http';
import {allRows} from '@/server/paging';
import {z} from 'zod';
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'salary.read');
 const access=await client.rpc('has_permission',{c:companyId,permission_code:'employees.sensitive'});databaseError(access.error);if(!access.data)throw new ApiError(403,'FORBIDDEN','Employee Database contains private employee information.');
 const param=new URL(request.url).searchParams.get('employeeId'),id=param?z.string().uuid().parse(param):null;
 const rows=await allRows((first,last)=>{let query=client.from('employee_master_revisions').select('id,employee_id,source_data,created_at').eq('company_id',companyId).order('revision_no',{ascending:false}).range(first,last);if(id)query=query.eq('employee_id',id);return query;});
 const latest=new Map<string,typeof rows[number]>();for(const row of rows)if(!latest.has(row.employee_id))latest.set(row.employee_id,row);
 return result({rows:[...latest.values()],revisions:rows.length});
});
