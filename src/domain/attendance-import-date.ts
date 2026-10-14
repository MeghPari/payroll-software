// CSV exports from Indian spreadsheet settings commonly use day-month-year.
// Normalize explicitly; never let Date guess a locale or roll over bad dates.
export function normalizeAttendanceImportDate(value:string):string|null{
 const text=value.trim();let iso=text;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(text)){
  const match=/^(\d{1,2})([-/])(\d{1,2})\2(\d{4})$/.exec(text);
  if(!match)return null;
  iso=`${match[4]}-${match[3].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
 }
 const date=new Date(`${iso}T00:00:00Z`);
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:null;
}
