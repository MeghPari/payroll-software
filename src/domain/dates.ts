export function companyToday() {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=(name:string)=>parts.find(p=>p.type===name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function monthKey(value:string) {
 if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return value;
 const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const [name,year]=value.split(' '), index=months.indexOf(name);
 if(index<0||!/^\d{4}$/.test(year))throw new Error('Invalid payroll month.');
 return `${year}-${String(index+1).padStart(2,'0')}`;
}
export function monthLabel(key:string) {return new Intl.DateTimeFormat('en-IN',{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(`${key}-01T00:00:00Z`));}
