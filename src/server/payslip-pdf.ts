import 'server-only';
import 'regenerator-runtime/runtime.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument,rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
export interface PayslipContent{setupWarnings?:{check:string;severity:string}[];companyName:string;employeeName:string;employeeCode:string;month:string;calendarDays:number;proration?:string;prorationDays?:number;paidDays:number;grossMinor:number;deductionMinor:number;netMinor:number;earnings:Record<string,number>;deductions:Record<string,number>;employer:Record<string,number>}
const labels:Record<string,string>={basic:'Basic',hra:'HRA',special:'Special allowance',conveyance:'Conveyance',other:'Other earnings',bonus:'Bonus',overtime:'Overtime',arrears:'Arrears',reimbursement:'Reimbursement',variable:'Variable pay',pf:'PF',esi:'ESI',pt:'Professional tax',tds:'TDS',loan:'Loan recovery',advance:'Advance recovery',otherDeduction:'Other deduction',employerOther:'Other employer contribution'};
export async function payslipPdf(content:PayslipContent,id:string,status:string,date:string){
 const document=await PDFDocument.create();document.registerFontkit(fontkit);
 const bytes=await readFile(join(process.cwd(),'assets','fonts','NotoSansDevanagari.ttf'));
 const font=await document.embedFont(bytes,{subset:true});
 document.setTitle(`Payslip ${content.employeeCode} ${content.month}`);document.setCreationDate(new Date(date));document.setModificationDate(new Date(date));
 let page=document.addPage([595,842]);let y=790;
 const available=new Set(font.getCharacterSet());
 const line=(text:string,size=11)=>{
  if([...text].some(character=>!available.has(character.codePointAt(0)!)))throw new Error('PAYSLIP_FONT_UNSUPPORTED');
  const draw=(value:string)=>{if(y<50){page=document.addPage([595,842]);y=790;}page.drawText(value,{x:50,y,size,font,color:rgb(.12,.16,.22)});y-=size+12;};
  let segment='';for(const character of text){if(segment&&font.widthOfTextAtSize(segment+character,size)>495){draw(segment);segment='';}segment+=character;}draw(segment);
 };
 const money=(amount:number)=>`INR ${(amount/100).toFixed(2)}`;
 line(content.companyName,18);line(`Payslip - ${content.month.slice(0,7)}`,14);line(`${content.employeeName} (${content.employeeCode})`);line(`Calendar days: ${content.calendarDays}   Paid days: ${content.paidDays}`);if(content.proration)line(`Proration: ${content.proration}   Basis days: ${content.prorationDays??content.calendarDays}`);line(`Status: ${status}   Reference: ${id}`,8);y-=10;
 line('Earnings',13);for(const[code,amount]of Object.entries(content.earnings))line(`${labels[code]??code}: ${money(amount)}`);
 line(`Gross earnings: ${money(content.grossMinor)}`,12);y-=8;
 line('Deductions',13);for(const[code,amount]of Object.entries(content.deductions))line(`${labels[code]??code}: ${money(amount)}`);
 line(`Total deductions: ${money(content.deductionMinor)}`,12);line(`Net payable: ${money(content.netMinor)}`,14);
 if(status==='Draft')line('Draft - pending publication',10);
 if(content.setupWarnings?.some(warning=>warning.check==='Statutory Configuration'&&warning.severity==='Warning'))line('Provisional net pay: unconfigured statutory deductions are excluded. Review statutory setup.',10);
 return document.save();
}
