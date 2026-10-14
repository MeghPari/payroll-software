import { sum } from './money';import { decimalMinor,type ReportEntry,type ReportTable } from './accounting-reports';
export interface CashFlowReview{journal_id:string;version:number;net_minor:number;allocations:{category:'Operating'|'Investing'|'Financing';amountMinor:number}[];review_reference:string}
export function cashFlowReport(month:string,accountIds:string[],entries:ReportEntry[],reviews:CashFlowReview[]):ReportTable{
 const selected=new Set(accountIds),start=month+'-01',end=new Date(start+'T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);const next=end.toISOString().slice(0,10),posted=entries.filter(entry=>entry.status==='Posted'&&entry.date<next);
 const movement=(entry:ReportEntry)=>sum(entry.journal_lines.filter(line=>selected.has(line.account_id)).map(line=>Number(line.debit_minor)-Number(line.credit_minor)));
 const opening=sum(posted.filter(entry=>entry.date<start).map(movement)),period=posted.filter(entry=>entry.date>=start),lookup=new Map(reviews.map(review=>[review.journal_id,review]));
 const rows:(string|number)[][]=[],classified:Record<string,number[]>={Operating:[],Investing:[],Financing:[],Unreviewed:[]};
 for(const entry of period){const net=movement(entry);if(net===0)continue;const review=lookup.get(entry.id),valid=review&&Number(review.net_minor)===net&&sum(review.allocations.map(part=>Number(part.amountMinor)))===net;
 if(valid){for(const part of review.allocations){classified[part.category].push(Number(part.amountMinor));rows.push([entry.date,entry.voucher_number,part.category,decimalMinor(Number(part.amountMinor)),review.review_reference]);}}
 else{classified.Unreviewed.push(net);rows.push([entry.date,entry.voucher_number,'Unreviewed',decimalMinor(net),review?'Book/account classification changed; review again':'Classification not reviewed']);}}
 const net=sum(period.map(movement));
 rows.push(['','Opening bank/cash books','',decimalMinor(opening),'']);for(const[category,amounts]of Object.entries(classified))rows.push(['',category+' total',category,decimalMinor(sum(amounts)),'']);rows.push(['','Net change','',decimalMinor(net),''],['','Closing bank/cash books','',decimalMinor(sum([opening,net])),'']);
 return{title:'Reviewed Cash Flow',month,headers:['Date','Voucher','Activity','Signed Movement INR','Review Reference'],rows,note:'Bank/cash balances reconcile to posted journals using currently configured bank/cash ledgers. Internal transfers with zero combined movement are excluded. Unreviewed or changed classifications remain explicit. This is a book review, not a bank statement or filed financial statement.'};
}
