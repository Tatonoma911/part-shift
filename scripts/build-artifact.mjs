// Turns the Vite build into one self-contained HTML fragment for a claude.ai Artifact
// (no external files allowed there). `npm run artifact` builds with ARTIFACT=1 (images inlined) and calls this.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const js = readdirSync('dist-artifact/assets').find((f) => f.endsWith('.js'));
const code = readFileSync(`dist-artifact/assets/${js}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<title>Part Shift</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&family=Unbounded:wght@700;800;900&display=swap">
<style>
  :root { --bg: #dfeef3; color-scheme: light; }
  html, body { height: 100%; margin: 0; background: var(--bg); overflow: hidden; }
  #app { width: 100%; height: 100%; touch-action: none; user-select: none; -webkit-user-select: none; }
</style>
<div id="app"></div>
<script type="module">${code}</script>
`;
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/part-shift.html', html);
console.log(`artifact/part-shift.html: ${(html.length / 1024).toFixed(0)} KB`);
