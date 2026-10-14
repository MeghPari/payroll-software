import { readFile, readdir, writeFile } from 'node:fs/promises';
const directory = new URL('../supabase/migrations/', import.meta.url);
const names = (await readdir(directory)).filter(name => name.endsWith('.sql') && name >= '202610110019' && name < '202610120021').sort();
const parts = [];
for (const name of names) {
  const sql = await readFile(new URL(name, directory), 'utf8');
  parts.push(`-- ${name}\n${sql.replace(/^begin;\s*/i, '').replace(/commit;\s*$/i, '')}`);
}
await writeFile(new URL('../supabase/upgrade-next.sql', import.meta.url), `-- Apply ONCE after the previously applied upgrade.sql (migrations 001-018).\n-- Additive invoices, banking and payment-evidence upgrade.\n-- This does not initiate transfers, change attendance, or finalize payroll.\n-- Existing company, users and payroll records are retained.\nbegin;\n${parts.join('\n')}\ncommit;\n`);
console.log(`Packaged ${names.length} additional migrations into supabase/upgrade-next.sql.`);
