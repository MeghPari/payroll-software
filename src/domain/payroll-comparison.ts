export interface PayComparisonInput{employeeId:string;netMinor:number;paidDays:number}
export interface PayComparisonRow extends PayComparisonInput{
 previousNetMinor:number|null;
 previousPaidDays:number|null;
 changeMinor:number|null;
 changePercent:number|null;
 needsReview:boolean;
}
export function previousPayrollMonth(month:string){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Invalid payroll month');
 const date=new Date(`${month}-01T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()-1);return date.toISOString().slice(0,7);
}
// Signals for manual review, never automatic edits or blocking errors.
// Flag a change of at least INR 1,000 and 20%, or a move to/from zero.
export function comparePayroll(current:readonly PayComparisonInput[],previous:readonly PayComparisonInput[]):PayComparisonRow[]{
 const prior=new Map(previous.map(row=>[row.employeeId,row]));
 for(const row of [...current,...previous])if(!Number.isSafeInteger(row.netMinor)||row.netMinor<0)throw new Error('Invalid saved salary amount');
 return current.map(row=>{
  const before=prior.get(row.employeeId);
  if(!before)return{...row,previousNetMinor:null,previousPaidDays:null,changeMinor:null,changePercent:null,needsReview:false};
  const changeMinor=row.netMinor-before.netMinor;
  const needsReview=Math.abs(changeMinor)>=100000&&(before.netMinor===0||row.netMinor===0||BigInt(Math.abs(changeMinor))*BigInt(100)>=BigInt(before.netMinor)*BigInt(20));
  return{...row,previousNetMinor:before.netMinor,previousPaidDays:before.paidDays,changeMinor,changePercent:before.netMinor===0?null:changeMinor/before.netMinor*100,needsReview};
 });
}
