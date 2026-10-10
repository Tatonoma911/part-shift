// Turns the Vite build into the claude.ai Artifact: one HTML page with the game script, plus the
// art and audio files it loads (published next to the page, see artifact/files.json).
// `npm run artifact` builds with ARTIFACT=1 and calls this.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const js = readdirSync('dist-artifact/assets').find((f) => f.endsWith('.js'));
// Reference the JS as an external file rather than inlining it — the inline bundle triggered
// the Artifact service's pr-review size check at ~6 MB; an external src avoids that entirely.
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
<script type="module" src="./files/${js}"></script>
`;
rmSync('artifact', { recursive: true, force: true });
mkdirSync('artifact/files', { recursive: true });
writeFileSync('artifact/part-shift.html', html);
// All assets including the JS bundle go into artifact/files/ next to the page.
const files = readdirSync('dist-artifact/assets');
for (const f of files) copyFileSync(`dist-artifact/assets/${f}`, `artifact/files/${f}`);
writeFileSync('artifact/files.json', JSON.stringify(files));
console.log(`artifact/part-shift.html: ${(html.length / 1024).toFixed(0)} KB + ${files.length} files in artifact/files`);
