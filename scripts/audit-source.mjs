import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(path.join(dir,e.name)) : path.join(dir,e.name)))).flat();
}
const files = (await walk('src')).sort();
let output = '# Baseline UI action and data dependency inventory\n\nGenerated before backend implementation. Every source file was scanned; UI primitives without business handlers are omitted. Line numbers describe baseline source. This is an audit inventory, not a list of implemented endpoints.\n';
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const matches = source.split(/\r?\n/).flatMap((line, i) => /onClick|onSubmit|toast\.|data\/mock|mockDelay|localStorage|setTimeout|useOperations/.test(line) ? [`${i+1}: ${line.trim()}`] : []);
  if(matches.length) output += `\n## ${file.replaceAll('\\','/')}\n\n\`\`\`text\n${matches.join('\n')}\n\`\`\`\n`;
}
await writeFile('docs/UI_ACTION_INVENTORY.md',output);
