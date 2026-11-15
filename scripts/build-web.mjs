// Copies the static site into www/ (used by GitHub Pages and the Android build).
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const p of ['index.html', 'css', 'js']) cpSync(p, `www/${p}`, { recursive: true });
console.log('Built www/');
