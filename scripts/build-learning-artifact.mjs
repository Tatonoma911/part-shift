// One self-contained HTML file with the learning preview (guide, clips, coach cards)
// for a claude.ai Artifact. `npm run learning-artifact` builds with LEARNING=1 and calls this.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';

const js = readdirSync('dist-learning/assets').find((f) => f.endsWith('.js'));
const code = readFileSync(`dist-learning/assets/${js}`, 'utf8').replace(/<\/script/gi, '<\\/script');
const html = `<title>Part Shift: обучение</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&family=Unbounded:wght@700;800;900&display=swap">
<style>:root{color-scheme:light}html,body{margin:0;background:#DFEEF3}</style>
<div id="learning-demo"></div>
<script type="module">${code}</script>
`;
mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/learning.html', html);
console.log(`artifact/learning.html: ${(html.length / 1024).toFixed(0)} KB`);
