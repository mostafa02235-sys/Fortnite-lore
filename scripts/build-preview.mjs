// Builds the self-contained offline preview (published as the Claude Artifact)
// into dist-preview/: same app code, Supabase swapped for preview/client.js.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
rmSync('dist-preview', { recursive: true, force: true });
mkdirSync('dist-preview');
for (const p of ['css', 'js']) cpSync(p, `dist-preview/${p}`, { recursive: true });
cpSync('preview', 'dist-preview/preview', { recursive: true, filter: s => !s.endsWith('index.html') });
const html = readFileSync('preview/index.html', 'utf8')
  .replace('"./client.js"', '"./preview/client.js"')
  .replaceAll('../css/', 'css/').replaceAll('../js/', 'js/');
writeFileSync('dist-preview/index.html', html);
// Belt and braces: point the Supabase module straight at the preview client too,
// so the preview works even where import maps are unavailable.
writeFileSync('dist-preview/js/supabase.js', "import { createClient } from '../preview/client.js';\nexport const sb = createClient();\n");
console.log('Built dist-preview/');
