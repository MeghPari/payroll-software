import {cellText,spreadsheetDate,type SheetRows} from './spreadsheet-import';
import type {AttendanceImportRow} from '../services/attendance.service';
import {CLIENT_ATTENDANCE_ID_COLUMNS} from './client-template-columns';
export interface AttendanceCodePolicy{leave?:'Paid Leave'|'Unpaid Leave';holiday?:'Holiday'|'Weekly Off'}
export function isClientAttendanceGrid(rows:SheetRows){
 const headers=(rows[0]??[]).map(cell=>cellText(cell));
 return headers.includes('Employee Code')&&!headers.includes('Date')&&(headers.some(h=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(h))||(rows[1]??[]).some(cell=>!!spreadsheetDate(cell)));
}
export function clientAttendanceTemplate(month:string){
 const start=new Date(month+'-01T00:00:00Z');if(Number.isNaN(start.getTime())||start.toISOString().slice(0,7)!==month)throw new Error('Invalid month.');
 const count=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
 const dates=Array.from({length:count},(_,index)=>`${month}-${String(index+1).padStart(2,'0')}`);
 const slots=[...dates,...Array(31-count).fill('')];
 return{headers:[...CLIENT_ATTENDANCE_ID_COLUMNS,...slots.map(date=>date?new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'UTC'}).format(new Date(date+'T00:00:00Z')):''),'Present','WFH','Half Day','Leave','Absent'],rows:[[...Array(7).fill(''),...slots,...Array(5).fill('')]]};
}
export function clientAttendanceRows(rows:SheetRows,month:string,policy:AttendanceCodePolicy):AttendanceImportRow[]{
 const headers=rows[0]??[],find=(name:string)=>headers.findIndex(value=>cellText(value)===name),codeIndex=find('Employee Code');
 if(codeIndex<0)throw new Error('Employee Code is required in the attendance header.');
 const nameIndex=find('Employee Name'),metadata=(row:SheetRows[number],name:string)=>cellText(row[find(name)]);
 const columns=rows[1]?.flatMap((value,index)=>{const date=spreadsheetDate(value);return date?[{index,date}]:[];})??[];
 if(!columns.length)throw new Error('The attendance grid needs actual dates in row 2.');
 if(new Set(columns.map(column=>column.date)).size!==columns.length)throw new Error('Duplicate dates in attendance headers.');
 if(columns.some(column=>!column.date.startsWith(month+'-')))throw new Error('The attendance grid dates do not match the selected payroll month.');
 const result:AttendanceImportRow[]=[];
 for(let index=2;index<rows.length;index++){
  const row=rows[index];if(!row.some(value=>value!==null&&value!==''&&value!==undefined))continue;
  const employeeId=cellText(row[codeIndex]),employeeName=cellText(row[nameIndex]);
  if(!employeeId)throw new Error(`Row ${index+1}: Employee Code is required.`);
  const summaryLabels=['Present','WFH','Half Day','Leave','Absent'],metadataLabels=[...CLIENT_ATTENDANCE_ID_COLUMNS,'Joining Date','Date of Joining (DOJ)','DOJ','Designation'];
  for(let column=columns[0].index;column<headers.length;column++)if(!columns.some(date=>date.index===column)&&!summaryLabels.includes(cellText(headers[column]))&&!metadataLabels.includes(cellText(headers[column]))&&cellText(row[column]))throw new Error('Row '+(index+1)+': attendance is entered in a column without a valid date header.');
  const counts:Record<string,number>={P:0,WFH:0,HD:0,L:0,A:0,H:0};
  for(const column of columns){
   const code=cellText(row[column.index]).toUpperCase();if(!code)continue;
   if(!(code in counts))throw new Error(`Row ${index+1}, ${column.date}: use P, WFH, HD, L, A or H.`);
   if(code==='L'&&!policy.leave)throw new Error('Choose whether L means paid or unpaid leave before validating.');
   if(code==='H'&&!policy.holiday)throw new Error('Choose whether H means holiday or weekly off before validating.');
   counts[code]++;
   const status=({P:'Present',WFH:'Work From Home',HD:'Half Day',L:policy.leave,A:'Absent',H:policy.holiday})[code]!;
   result.push({employeeId,employeeName,counterCode:metadata(row,'Counter Code'),counterName:metadata(row,'Counter Name'),location:metadata(row,'Location'),state:metadata(row,'State'),department:metadata(row,'Function'),joiningDate:cellText(row[headers.findIndex(header=>['Joining Date','Date of Joining (DOJ)','DOJ'].includes(cellText(header)))]),date:column.date,status,shift:'',checkIn:'',checkOut:'',workHours:'0',leaveType:code==='L'?'Client attendance leave':'',overtime:'0',remarks:'Client monthly attendance grid'});
  }
  const labels:Record<string,string>={Present:'P',WFH:'WFH','Half Day':'HD',Leave:'L',Absent:'A'};
  rows[0].forEach((header,position)=>{const code=labels[cellText(header)],value=cellText(row[position]);if(code&&value!==''&&(!/^\d+$/.test(value)||Number(value)!==counts[code]))throw new Error(`Row ${index+1}: ${cellText(header)} summary does not match the daily codes.`);});
 }
 if(!result.length)throw new Error('The attendance template has no marked dates. Blank cells remain unrecorded.');
 if(result.length>1000)throw new Error('Upload at most 1,000 marked employee dates at a time. Split the grid by employees.');
 return result;
}
