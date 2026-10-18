import {assertSafeXlsx,sheetRecords,type SheetRows} from '@/domain/spreadsheet-import';
import {parseCSV} from '@/domain/csv';
export async function readImportSheet(file:File):Promise<SheetRows>{
 if(file.size>2_000_000)throw new Error('Import files must be under 2 MB.');
 if(!/\.xlsx$/i.test(file.name))throw new Error('Choose an .xlsx workbook. Legacy .xls files must be saved as .xlsx or CSV.');
 const buffer=await file.arrayBuffer();assertSafeXlsx(buffer);
 const {readSheet}=await import('read-excel-file/browser');
 const rows=await readSheet(buffer);
 if(rows.length>16000||rows.some(row=>row.length>100))throw new Error('Worksheet exceeds the supported import dimensions.');
 return rows.map(row=>row.map(value=>{if(value===null||typeof value==='string'||typeof value==='number'||typeof value==='boolean'||value instanceof Date)return value;throw new Error('Unsupported worksheet cell type.');}));
}
export async function readImportRecords(file:File){
 if(file.size>2_000_000)throw new Error('Import files must be under 2 MB.');
 const records=/\.csv$/i.test(file.name)?parseCSV(await file.text()):sheetRecords(await readImportSheet(file));
 if(!records.length)throw new Error('The template has no data rows. Fill employee records before uploading.');
 if(records.length>1000)throw new Error('Upload at most 1,000 rows at a time.');
 return records;
}
