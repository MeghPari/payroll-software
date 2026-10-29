export interface PayslipModuleRow {
 employeeId:string;employeeName:string;employeeCode:string;department:string;email:string;
 grossMinor:number|null;netMinor:number|null;payslipId:string|null;status:'Not generated'|'Generated'|'Published';
 runStatus:string|null;batchNumber:number|null;generatedAt:string|null;publishedAt:string|null;canGenerate:boolean;reason:string;
 emailStatus:'Not sent'|'Sending'|'Sent'|'Failed'|'Unconfirmed';emailAttemptId:string|null;emailError:string|null;emailsSent:boolean;
}
export interface PayslipDashboard {items:PayslipModuleRow[];canManage:boolean;emailConfigured:boolean}
export interface PayslipEmailAttempt {id:string;recipient:string;status:string;created_at:string;completed_at:string|null;provider_id:string|null;error_code:string|null}
export interface PayslipRevision {id:string;generated_at:string;archived_at:string;run_version:number;status:string}
export const payslipEmailMessage:Record<string,string>={
 EMAIL_PROVIDER_NOT_CONFIGURED:'Configure the payslip email sender first.',
 EMAIL_PROVIDER_REJECTED:'The email provider rejected the request. Check the sender and employee email, then retry.',
 EMAIL_RATE_LIMITED:'Email provider rate limit reached. Wait before retrying.',
 EMAIL_UNCONFIRMED:'The provider outcome could not be confirmed. Check the provider before sending again.',
 PDF_INVALID:'The saved payslip could not be rendered. Review its source details.',
};
