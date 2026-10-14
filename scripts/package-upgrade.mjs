import { readFile,readdir,writeFile } from 'node:fs/promises';
const directory=new URL('../supabase/migrations/',import.meta.url);
// Freeze the upgrade already supplied to the operator. Later migrations need a separate package.
const names=(await readdir(directory)).filter(name=>name.endsWith('.sql')&&name>='202610090003'&&name<'202610090019').sort();
const parts=[];
for(const name of names){
 const sql=await readFile(new URL(name,directory),'utf8');
 parts.push(`-- ${name}\n${sql.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'')}`);
}
await writeFile(new URL('../supabase/upgrade.sql',import.meta.url),`-- Additive upgrade for projects that already applied setup.sql (001 and 002).\n-- Apply once in the SQL Editor as the database owner. Existing company/auth records are retained.\nbegin;\n${parts.join('\n')}\ncommit;\n`);
console.log(`Packaged ${names.length} migrations into supabase/upgrade.sql.`);
