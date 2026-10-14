export const DOCUMENT_TYPES=['PAN Card','Aadhaar','Cancelled Cheque','Bank Proof','Offer Letter','Other Document'] as const;
export const DOCUMENT_LIMIT=10*1024*1024;
export interface EmployeeDocument{id:string;employee_id:string;document_type:typeof DOCUMENT_TYPES[number];original_name:string;mime_type:string;byte_size:number;sha256:string;status:'Uploading'|'Pending Verification'|'Verified'|'Rejected'|'Removed';version:number;uploaded_at:string;review_reason:string}
export function documentFormat(bytes:Uint8Array){
 if(bytes.length>=5&&String.fromCharCode(...bytes.slice(0,5))==='%PDF-')return{mime:'application/pdf',extension:'pdf'};
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value))return{mime:'image/png',extension:'png'};
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return{mime:'image/jpeg',extension:'jpg'};
 throw new Error('Use a PDF, PNG or JPEG file with matching file content.');
}
