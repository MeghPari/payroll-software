import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body,databaseError, endpoint, result } from '@/server/http';
export const GET = endpoint(async request => {
  const { client, companyId } = await tenant(request);
  const response = await client.from('companies').select('*').eq('id', companyId).single();
  databaseError(response.error); return result(response.data);
});

export const PUT=endpoint(async request=>{const{client,companyId}=await tenant(request,'settings.write');const input=await body(request,z.object({expectedVersion:z.number().int().positive(),profile:z.object({name:z.string().trim().min(1).max(160),gstin:z.string().regex(/^(?:[A-Z0-9]{15})?$/),address:z.string().max(1000),email:z.union([z.literal(''),z.string().email().max(254)]),phone:z.string().max(30),supportEmail:z.union([z.literal(''),z.string().email().max(254)]),supportPhone:z.string().max(30)}).strict()}).strict());const response=await client.rpc('save_company_profile',{c:companyId,expected_version:input.expectedVersion,p:input.profile});databaseError(response.error);return result({saved:true});});
