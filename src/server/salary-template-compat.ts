import 'server-only';import type {SupabaseClient} from '@supabase/supabase-js';import {ApiError,databaseError} from './http';
export async function hasDaComponent(client:SupabaseClient){const response=await client.from('salary_components').select('code').eq('code','da').maybeSingle();databaseError(response.error);return!!response.data;}
export function compatibleSalaryAmounts(amounts:Record<string,number>,hasDa:boolean){
 if(hasDa||!('da'in amounts))return amounts;
 if(amounts.da!==0)throw new ApiError(503,'MIGRATION_REQUIRED','Apply the client-template upgrade before assigning DA.');
 return Object.fromEntries(Object.entries(amounts).filter(([code])=>code!=='da'));
}
