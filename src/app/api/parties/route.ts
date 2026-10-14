import { z } from 'zod';
import { tenant } from '@/server/auth';
import { body,databaseError,endpoint,result } from '@/server/http';
import { partyInput } from '@/domain/invoice-input';
export const GET=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'accounting.read');const kind=z.enum(['Customer','Vendor']).parse(new URL(request.url).searchParams.get('kind'));
 const parties=[];
 for(let offset=0;;offset+=500){const response=await client.from('business_parties').select('*').eq('company_id',companyId).eq('kind',kind).order('id').range(offset,offset+499);databaseError(response.error);parties.push(...(response.data??[]));if((response.data?.length??0)<500)break;}
 return result(parties);
});
export const POST=endpoint(async request=>{
 const {client,companyId}=await tenant(request,'accounting.write');const input=await body(request,partyInput);
 const response=await client.rpc('save_party',{c:companyId,p:input,e:input.id??null,expected_version:input.expectedVersion??null});databaseError(response.error);return result({id:response.data});
});
