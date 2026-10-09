// Turns the Vite build into one self-contained HTML fragment for a claude.ai Artifact
// (no external files allowed there). Run after `npm run build`: `npm run artifact`.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const js = readdirSync('dist/assets').find((f) => f.endsWith('.js'));
const code = readFileSync(`dist/assets/${js}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<title>Part Shift</title>
<style>
  :root { --bg: #0f1420; color-scheme: dark; }
  html, body { height: 100%; margin: 0; background: var(--bg); overflow: hidden; }
  #app { width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; }
</style>
<div id="app"></div>
<script type="module">${code}</script>
`;
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/part-shift.html', html);
console.log(`artifact/part-shift.html: ${(html.length / 1024).toFixed(0)} KB`);
