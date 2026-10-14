import { readFile,readdir,writeFile,rename } from 'node:fs/promises';
const directory=new URL('../supabase/migrations/',import.meta.url);
const names=(await readdir(directory)).filter(name=>name.endsWith('.sql')&&name>='202610140032'&&name<'202610140036').sort();
const parts=[];for(const name of names){const source=await readFile(new URL(name,directory),'utf8');if(!source.trim())throw new Error('Empty migration '+name);parts.push(`-- ${name}\n${source.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'')}`);}
const target=new URL('../supabase/upgrade-followup.sql',import.meta.url),temporary=new URL('../supabase/upgrade-followup.sql.codex-tmp',import.meta.url);
await writeFile(temporary,`-- Apply ONCE after the confirmed migrations 001-031.\n-- Additive GST review archives, failed-payment/retry evidence, request limits, year-close guards and working-day proration.\n-- Existing company, payroll and payment records are retained. No transfer or filing is initiated.\nbegin;\n${parts.join('\n')}\ncommit;\n`);await rename(temporary,target);
console.log(`Packaged ${names.length} migrations into supabase/upgrade-followup.sql.`);
