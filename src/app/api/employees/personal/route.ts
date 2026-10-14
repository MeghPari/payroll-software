import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body,databaseError,endpoint,result } from '@/server/http';
import { invoiceDate } from '@/domain/invoice-input';
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'employees.sensitive');
 const text=(max:number)=>z.string().trim().max(max).default('');
 const p=await body(request,z.object({employeeId:z.string().uuid(),expectedVersion:z.number().int().positive(),personal:z.object({personalEmail:z.union([z.literal(''),z.string().email().max(254)]),dateOfBirth:z.union([z.literal(''),invoiceDate]),gender:z.enum(['','Male','Female','Other']),address:text(1000),city:text(100),pincode:z.string().regex(/^(?:\d{6})?$/),bloodGroup:z.enum(['','A+','A-','B+','B-','AB+','AB-','O+','O-']),maritalStatus:z.enum(['','Single','Married','Divorced','Widowed']),nationality:text(100),languages:z.array(z.string().trim().min(1).max(60)).max(20),emergencyContact:z.object({name:text(100),relation:text(100),phone:text(30)}).strict()}).strict()}).strict());
 const response=await client.rpc('save_employee_personal',{c:companyId,e:p.employeeId,expected_version:p.expectedVersion,p:p.personal});databaseError(response.error);return result({saved:true});
});
