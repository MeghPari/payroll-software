import type { GstInvoice } from './compliance';
export type GstSource=GstInvoice&{journal_id:string;status:string};
export function gstBookRows(month:string,invoices:GstSource[],reversals:{id:string;date:string;reversal_of:string}[]):GstInvoice[]{
 const rows:GstInvoice[]=[];
 for(const invoice of invoices){
  if(invoice.date.slice(0,7)===month)rows.push({...invoice,creditEditable:invoice.status==='Posted'});
  for(const reversal of reversals.filter(row=>row.reversal_of===invoice.journal_id&&row.date.slice(0,7)===month)){
   const credit=invoice.gst_credit_reviews;
   rows.push({...invoice,id:reversal.id,invoice_number:invoice.invoice_number+' (book reversal)',date:reversal.date,creditEditable:false,taxable_minor:-Number(invoice.taxable_minor),cgst_minor:-Number(invoice.cgst_minor),sgst_minor:-Number(invoice.sgst_minor),igst_minor:-Number(invoice.igst_minor),gst_credit_reviews:credit?{...credit,cgst_minor:-Number(credit.cgst_minor),sgst_minor:-Number(credit.sgst_minor),igst_minor:-Number(credit.igst_minor)}:null});
  }
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
