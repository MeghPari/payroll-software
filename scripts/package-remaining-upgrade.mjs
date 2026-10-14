import { readFile,readdir,writeFile } from 'node:fs/promises';
const directory=new URL('../supabase/migrations/',import.meta.url);
const names=(await readdir(directory)).filter(name=>name.endsWith('.sql')&&name>='202610120021'&&name<'202610140032').sort();
const parts=[];
for(const name of names){const source=await readFile(new URL(name,directory),'utf8');parts.push(`-- ${name}\n${source.replace(/^begin;\s*/i,'').replace(/commit;\s*$/i,'')}`);}
await writeFile(new URL('../supabase/upgrade-remaining.sql',import.meta.url),`-- Apply ONCE after setup.sql, upgrade.sql and upgrade-next.sql (001-020).\n-- Adds private documents, employee profiles, administration, GST credit reviews and in-app notifications.\n-- Existing records are retained. No payment, filing or email is initiated.\nbegin;\n${parts.join('\n')}\ncommit;\n`);
console.log(`Packaged ${names.length} migrations into supabase/upgrade-remaining.sql.`);
