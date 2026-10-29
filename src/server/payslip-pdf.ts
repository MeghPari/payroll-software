import 'server-only';
import 'regenerator-runtime/runtime.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument,rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
export interface PayslipContent {
 setupWarnings?:{check:string;severity:string}[];companyName:string;companyProfile?:{address?:string;email?:string;phone?:string};
 employeeName:string;employeeCode:string;department?:string;designation?:string;joiningDate?:string;workLocation?:string;
 month:string;calendarDays:number;proration?:string;prorationDays?:number;paidDays:number;
 attendance?:{present?:number;paidLeave?:number;weeklyOff?:number;holidays?:number;lopDays?:number;halfDays?:number};
 salary?:{structure?:string}|null;grossMinor:number;deductionMinor:number;netMinor:number;
 earnings:Record<string,number>;deductions:Record<string,number>;employer:Record<string,number>;
}
const labels:Record<string,string>={basic:'Basic',da:'Dearness allowance',sunday:'Sunday amount',incentive:'Incentive',uniformAdvance:'Uniform advance recovery',vehicleDamage:'Vehicle damage recovery',recovery:'Prior-month recovery',hra:'House rent allowance',special:'Special allowance',conveyance:'Conveyance',other:'Other allowance',bonus:'Bonus',overtime:'Overtime',arrears:'Arrears',reimbursement:'Reimbursement',variable:'Variable pay',pf:'Provident fund (PF)',esi:'Employee state insurance (ESI)',pt:'Professional tax',tds:'Tax deducted at source (TDS)',loan:'Loan recovery',advance:'Advance recovery',otherDeduction:'Other deduction',employerOther:'Other employer contribution'};
export async function payslipPdf(content:PayslipContent,id:string,status:string,date:string){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const font=await doc.embedFont(await readFile(join(process.cwd(),'assets','fonts','NotoSansDevanagari.ttf')),{subset:true});
 doc.setTitle(`Payslip ${content.employeeCode} ${content.month}`);doc.setCreationDate(new Date(date));doc.setModificationDate(new Date(date));
 const ink=rgb(.12,.18,.28),muted=rgb(.38,.43,.5),blue=rgb(.09,.32,.65),light=rgb(.94,.96,.99);
 let page=doc.addPage([595,842]),y=790;
 const chars=new Set(font.getCharacterSet());
 const text=(value:string,x:number,at:number,size=10,color=ink)=>{
  value=String(value).replace(/[\r\n\t]+/g,' ');
  if([...value].some(c=>!chars.has(c.codePointAt(0)!)))throw new Error('PAYSLIP_FONT_UNSUPPORTED');
  page.drawText(value,{x,y:at,size,font,color});
 };
 const ensure=(height:number)=>{if(y-height<62){page=doc.addPage([595,842]);y=790;text(`${content.companyName} | Payslip continued`,44,y,10,muted);y-=30;}};
 const wrap=(value:string,width:number,size=10)=>{const lines:string[]=[];let line='';for(const c of value){if(line&&font.widthOfTextAtSize(line+c,size)>width){lines.push(line);line='';}line+=c;}if(line)lines.push(line);return lines;};
 const paragraph=(value:string,size=10,color=ink)=>{for(const line of wrap(String(value).replace(/[\r\n\t]+/g,' '),507,size)){ensure(size+10);text(line,44,y,size,color);y-=size+8;}};
 const section=(title:string)=>{ensure(50);y-=8;page.drawRectangle({x:44,y:y-8,width:507,height:25,color:light});text(title,54,y,11,blue);y-=32;};
 const field=(label:string,value:string)=>{for(const line of wrap(`${label}: ${value||'Not provided'}`,507)){ensure(20);text(line,44,y,10);y-=19;}};
 const money=(amount:number)=>`INR ${(amount/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 const amount=(label:string,value:number,strong=false)=>{const lines=wrap(label,325,strong?11:10);ensure(lines.length*19+5);for(let i=0;i<lines.length;i++){text(lines[i],54,y,strong?11:10,strong?blue:ink);if(i===0){const m=money(value);text(m,541-font.widthOfTextAtSize(m,strong?11:10),y,strong?11:10,strong?blue:ink);}y-=19;}};
 paragraph(content.companyName,20,blue);
 if(content.companyProfile?.address)paragraph(content.companyProfile.address,9,muted);
 const contact=[content.companyProfile?.email,content.companyProfile?.phone].filter(Boolean).join(' | ');if(contact)paragraph(contact,9,muted);
 y-=10;paragraph(`PAYSLIP | ${content.month.slice(0,7)}`,14);paragraph(`${status==='Draft'?'DRAFT - pending publication':'Published'} | Generated ${new Date(date).toISOString().slice(0,10)}`,9,muted);
 section('Employee details');field('Employee',`${content.employeeName} (${content.employeeCode})`);
 field('Department / designation',[content.department,content.designation].filter(Boolean).join(' / '));
 if(content.joiningDate)field('Joining date',content.joiningDate);if(content.workLocation)field('Work location',content.workLocation);if(content.salary?.structure)field('Salary structure',content.salary.structure);
 section('Attendance');field('Calendar days / paid days',`${content.calendarDays} / ${content.paidDays}`);
 if(content.attendance){const a=content.attendance;field('Present / paid leave / half days',`${a.present??0} / ${a.paidLeave??0} / ${a.halfDays??0}`);field('Weekly offs / holidays / loss-of-pay days',`${a.weeklyOff??0} / ${a.holidays??0} / ${a.lopDays??0}`);}
 if(content.proration)field('Proration basis',`${content.proration} (${content.prorationDays??content.calendarDays} days)`);
 section('Earnings');for(const[code,value]of Object.entries(content.earnings))amount(labels[code]??code,value);amount('Gross salary',content.grossMinor,true);
 section('Deductions');if(!Object.keys(content.deductions).length)amount('No deductions',0);for(const[code,value]of Object.entries(content.deductions))amount(labels[code]??code,value);amount('Total deductions',content.deductionMinor,true);
 ensure(65);y-=12;page.drawRectangle({x:44,y:y-17,width:507,height:40,color:light});amount('NET SALARY',content.netMinor,true);y-=22;
 if(content.setupWarnings?.some(w=>w.check==='Statutory Configuration'&&w.severity==='Warning'))paragraph('Provisional net salary: unconfigured statutory deductions are excluded. Review the statutory setup.',9,muted);
 paragraph('Computer-generated payslip. This document records salary calculation and does not confirm a bank transfer.',8,muted);
 const pages=doc.getPages();for(let i=0;i<pages.length;i++){page=pages[i];text(`PayFlow | ${id} | ${i+1}/${pages.length}`,44,30,7,muted);}
 return doc.save();
}
