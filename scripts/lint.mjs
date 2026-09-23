import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const files = ['src/main.js', ...readdirSync(resolve(root, 'scripts')).filter((name) => name.endsWith('.mjs')).map((name) => `scripts/${name}`)];
for (const file of files) execFileSync(process.execPath, ['--check', resolve(root, file)], { stdio: 'inherit' });
console.log(`Syntax checked ${files.length} JavaScript files.`);
