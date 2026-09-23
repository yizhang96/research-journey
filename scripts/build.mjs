import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(resolve(dist, 'src/data'), { recursive: true });
await cp(resolve(root, 'index.html'), resolve(dist, 'index.html'));
await cp(resolve(root, 'src/main.js'), resolve(dist, 'src/main.js'));
await cp(resolve(root, 'src/styles.css'), resolve(dist, 'src/styles.css'));
await cp(resolve(root, 'src/data/genealogy.json'), resolve(dist, 'src/data/genealogy.json'));
await cp(resolve(root, 'src/data/schema.json'), resolve(dist, 'src/data/schema.json'));
if (await import('node:fs').then(({ existsSync }) => existsSync(resolve(root, 'public')))) {
  await cp(resolve(root, 'public'), resolve(dist, 'public'), { recursive: true });
}
console.log('Static site built in dist/.');
