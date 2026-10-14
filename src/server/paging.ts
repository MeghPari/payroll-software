import 'server-only';
import { databaseError } from './http';
export async function allRows<T>(read:(start:number,end:number)=>PromiseLike<{data:T[]|null;error:{code?:string;message:string}|null}>):Promise<T[]>{
 const rows:T[]=[];for(let offset=0;;offset+=250){const page=await read(offset,offset+249);databaseError(page.error);rows.push(...(page.data??[]));if((page.data?.length??0)<250)break;}return rows;
}
