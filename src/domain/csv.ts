export function escapeCSV(value:string|number){
 let text=String(value??'');
 // Spreadsheet programs treat these prefixes as executable formulas.
 if(typeof value==='string'&&/^[\s]*[=+\-@]/.test(text))text="'"+text;
 return /[",\r\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text;
}
export function parseCSVMatrix(source:string):string[][] {
 const text=source.replace(/^\uFEFF/,''),records:string[][]=[];
 let record:string[]=[],field='',quoted=false,closed=false;
 const finishField=()=>{record.push(field);field='';closed=false;};
 const finishRecord=()=>{finishField();if(record.some(value=>value.trim()))records.push(record);record=[];};
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(quoted){if(char==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=char;continue;}
  if(char===','){finishField();continue;}
  if(char==='\r'||char==='\n'){if(char==='\r'&&text[i+1]==='\n')i++;finishRecord();continue;}
  if(char==='"'){if(field||closed)throw new Error('Malformed CSV quoting.');quoted=true;continue;}
  if(closed){if(char===' '||char==='\t')continue;throw new Error('Unexpected text after a quoted CSV field.');}
  field+=char;
 }
 if(quoted)throw new Error('CSV contains an unterminated quoted field.');
 if(field||record.length||closed)finishRecord();
 return records;
}
export function parseCSV(source:string):Record<string,string>[] {
 const records=parseCSVMatrix(source);
 if(!records.length)return[];
 const headers=records.shift()!.map(value=>value.trim());
 if(headers.some(value=>!value)||new Set(headers).size!==headers.length)throw new Error('CSV needs unique, nonempty column headers.');
 return records.map((values,index)=>{if(values.length!==headers.length)throw new Error(`CSV row ${index+2} has ${values.length} columns; expected ${headers.length}.`);return Object.fromEntries(headers.map((header,i)=>[header,values[i].trim()]));});
}
