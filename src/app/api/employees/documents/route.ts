import { createHash } from 'node:crypto';
import { z } from 'zod';
import { tenant } from '@/server/auth';
import { ApiError,body,databaseError,endpoint,result } from '@/server/http';
import { DOCUMENT_LIMIT,DOCUMENT_TYPES,documentFormat } from '@/domain/documents';
const bucket='employee-documents';
export const runtime='nodejs';
async function uploadForm(request:Request){
 if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new ApiError(415,'CONTENT_TYPE','Choose an actual file to upload.');
 const limit=DOCUMENT_LIMIT+65536,declared=Number(request.headers.get('content-length'));
 if(declared>limit)throw new ApiError(413,'BODY_TOO_LARGE','Documents must be no larger than 10 MB.');
 const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'FILE_REQUIRED','Choose a file.');
 const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new ApiError(413,'BODY_TOO_LARGE','Documents must be no larger than 10 MB.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{return await new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')!},body:bytes.buffer}).formData();}catch{throw new ApiError(400,'INVALID_UPLOAD','The uploaded form could not be read.');}
}
export const GET=endpoint(async request=>{
 const{client,companyId}=await tenant(request);const params=new URL(request.url).searchParams;
 if(params.has('id')){
  const id=z.string().uuid().parse(params.get('id'));
  const doc=await client.from('employee_documents').select('*').eq('company_id',companyId).eq('id',id).maybeSingle();databaseError(doc.error);
  if(!doc.data||['Uploading','Removed'].includes(doc.data.status))throw new ApiError(404,'DOCUMENT_NOT_FOUND','Document is not available.');
  const download=await client.storage.from(bucket).download(doc.data.object_path);
  if(download.error||!download.data)throw new ApiError(503,'DOCUMENT_UNAVAILABLE','The private file could not be retrieved. Try again later.');
  const bytes=await download.data.arrayBuffer();
  if(bytes.byteLength!==doc.data.byte_size||createHash('sha256').update(Buffer.from(bytes)).digest('hex')!==doc.data.sha256)throw new ApiError(409,'DOCUMENT_INTEGRITY','The stored document does not match its upload record. Contact your administrator.');
  const audit=await client.rpc('record_private_download',{c:companyId,kind:'employee-document',r:id});databaseError(audit.error);
  return new Response(bytes,{headers:{'Content-Type':doc.data.mime_type,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(doc.data.original_name).replace(/'/g,'%27')}`,'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }
 const employeeId=z.string().uuid().parse(params.get('employeeId'));
 const access=await client.rpc('can_read_employee_document',{c:companyId,e:employeeId});databaseError(access.error);if(!access.data)throw new ApiError(403,'FORBIDDEN','Document access is not allowed.');
 const rows=[];for(let offset=0;;offset+=100){const page=await client.from('employee_documents').select('id,employee_id,document_type,original_name,mime_type,byte_size,sha256,status,version,uploaded_at,review_reason').eq('company_id',companyId).eq('employee_id',employeeId).order('uploaded_at',{ascending:false}).order('id').range(offset,offset+99);databaseError(page.error);rows.push(...(page.data??[]));if((page.data?.length??0)<100)break;}return result(rows);
});
export const POST=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'employees.sensitive');const form=await uploadForm(request);
 const employeeId=z.string().uuid().parse(form.get('employeeId')),documentType=z.enum(DOCUMENT_TYPES).parse(form.get('documentType')),file=form.get('file');
 if(!(file instanceof File)||!file.size)throw new ApiError(422,'FILE_REQUIRED','Choose a nonempty document.');
 if(file.size>DOCUMENT_LIMIT)throw new ApiError(413,'BODY_TOO_LARGE','Documents must be no larger than 10 MB.');
 const name=z.string().min(1).max(200).regex(/^[^\x00-\x1f\x7f\\/]+$/).parse(file.name),bytes=new Uint8Array(await file.arrayBuffer());
 let format:ReturnType<typeof documentFormat>;try{format=documentFormat(bytes);}catch(error){throw new ApiError(422,'FILE_FORMAT',error instanceof Error?error.message:'Invalid file format.');}
 if(file.type&&file.type!==format.mime)throw new ApiError(422,'FILE_FORMAT','The file content does not match its declared type.');
 const response=await client.rpc('reserve_employee_document',{c:companyId,e:employeeId,p:{documentType,fileName:name,mimeType:format.mime,byteSize:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});databaseError(response.error);
 const id=response.data as string,path=`${companyId}/${employeeId}/${id}/document.${format.extension}`;
 const upload=await client.storage.from(bucket).upload(path,bytes,{contentType:format.mime,upsert:false});
 if(upload.error){const cleanup=await client.rpc('review_employee_document',{c:companyId,d:id,expected_version:1,next_status:'Removed',reason_text:'Upload did not complete'});if(cleanup.error)console.error('Document reservation cleanup failed',{code:cleanup.error.code});throw new ApiError(503,'UPLOAD_FAILED','The private upload did not complete. Try again later.');}
 const completed=await client.rpc('finish_employee_document',{c:companyId,d:id});
 if(completed.error){const cleanup=await client.storage.from(bucket).remove([path]);if(cleanup.error)console.error('Document object cleanup failed');const cancelled=await client.rpc('review_employee_document',{c:companyId,d:id,expected_version:1,next_status:'Removed',reason_text:'Upload registration did not complete'});if(cancelled.error)console.error('Document registration cleanup failed',{code:cancelled.error.code});databaseError(completed.error);}
 return result({id,uploaded:true},201);
});
export const PATCH=endpoint(async request=>{
 const{client,companyId}=await tenant(request,'employees.sensitive');
 const input=await body(request,z.object({id:z.string().uuid(),expectedVersion:z.number().int().positive(),status:z.enum(['Verified','Rejected','Removed']),reason:z.string().trim().min(1).max(1000)}).strict());
 const doc=await client.from('employee_documents').select('object_path').eq('company_id',companyId).eq('id',input.id).maybeSingle();databaseError(doc.error);if(!doc.data)throw new ApiError(404,'NOT_FOUND','Document not found.');
 const response=await client.rpc('review_employee_document',{c:companyId,d:input.id,expected_version:input.expectedVersion,next_status:input.status,reason_text:input.reason});databaseError(response.error);
 if(input.status==='Removed'){const cleanup=await client.storage.from(bucket).remove([doc.data.object_path]);if(cleanup.error)return result({saved:true,cleanupPending:true});}
 return result({saved:true,cleanupPending:false});
});
