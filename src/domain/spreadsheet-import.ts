import {normalizeAttendanceImportDate} from './attendance-import-date';
export type SheetCell=string|number|boolean|Date|null;
export type SheetRows=SheetCell[][];
export function spreadsheetDate(value:SheetCell|undefined){
 if(value instanceof Date)return Number.isNaN(value.getTime())?null:value.toISOString().slice(0,10);
 if(typeof value==='number'){
  if(!Number.isInteger(value)||value<1||value>2958465||value===60)return null;
  return new Date(Date.UTC(1899,11,30)+(value<60?value+1:value)*86400000).toISOString().slice(0,10);
 }
 const text=String(value??'').trim(),named=/^(\d{1,2})[- /]([A-Za-z]{3})[- /](\d{4})$/.exec(text);
 if(named){const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[2].toLowerCase());return month<0?null:normalizeAttendanceImportDate(`${named[3]}-${String(month+1).padStart(2,'0')}-${named[1].padStart(2,'0')}`);}
 if(/^\d{5,6}$/.test(text))return spreadsheetDate(Number(text));
 return normalizeAttendanceImportDate(text);
}
export function cellText(value:SheetCell|undefined){
 if(value instanceof Date)return spreadsheetDate(value)??'';
 if(typeof value==='number'&&!Number.isSafeInteger(value)&&(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER))throw new Error('A number exceeds Excel-safe precision. Store identifiers as text.');
 return value===null||value===undefined?'':String(value).trim();
}
export function sheetRecords(rows:SheetRows):Record<string,string>[] {
 const first=rows.findIndex(row=>row.some(value=>value!==null&&value!==''));if(first<0)throw new Error('The worksheet is empty.');
 const headers=rows[first].map(cellText),nonempty=headers.filter(Boolean);
 if(new Set(nonempty).size!==nonempty.length)throw new Error('Duplicate column names. Use the monthly grid importer for attendance grids.');
 if(headers.length>100)throw new Error('Too many columns in the import.');
 return rows.slice(first+1).filter(row=>row.some(value=>value!==null&&value!==''&&value!==undefined)).map(row=>Object.fromEntries(headers.filter(Boolean).map(header=>{const index=headers.indexOf(header),value=row[index];if(['DOB','DOJ','Date of Birth (DOB)','Date of Joining (DOJ)','Date of Leaving (DOL)','Date of Birth','Date of Joining','Effective From','Date'].includes(header)&&value!==null&&value!==undefined&&value!=='')return[header,spreadsheetDate(value)??cellText(value)];return[header,cellText(value)];})));
}

// Check declared expansion before handing an untrusted ZIP to the XLSX reader.
export function assertSafeXlsx(buffer:ArrayBuffer){
 const bytes=new DataView(buffer);let end=-1;
 for(let at=buffer.byteLength-22;at>=Math.max(0,buffer.byteLength-65557);at--)if(bytes.getUint32(at,true)===0x06054b50){end=at;break;}
 if(end<0)throw new Error('Invalid XLSX file.');
 const count=bytes.getUint16(end+10,true),offset=bytes.getUint32(end+16,true),directorySize=bytes.getUint32(end+12,true);
 if(count<1||count>300||offset+directorySize>end||bytes.getUint16(end+4,true)!==0||bytes.getUint16(end+6,true)!==0)throw new Error('Unsupported or oversized XLSX archive.');
 let cursor=offset,total=0;
 for(let index=0;index<count;index++){
  if(cursor+46>offset+directorySize||bytes.getUint32(cursor,true)!==0x02014b50)throw new Error('Invalid XLSX archive directory.');
  const size=bytes.getUint32(cursor+24,true),method=bytes.getUint16(cursor+10,true),flags=bytes.getUint16(cursor+8,true);
  total+=size;if(size>8_000_000||total>16_000_000||flags&1||![0,8].includes(method))throw new Error('XLSX is encrypted, unsupported, or expands beyond the import limit.');
  cursor+=46+bytes.getUint16(cursor+28,true)+bytes.getUint16(cursor+30,true)+bytes.getUint16(cursor+32,true);
 }
 if(cursor!==offset+directorySize)throw new Error('Invalid XLSX directory size.');
}
