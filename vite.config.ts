import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// base './' so the build works from any GitHub Pages sub-path.
// Pages: the universe site at / (site/), the game at /play (src/), and the bare full-screen game at /mobile (the Android app's start page).
// ARTIFACT=1 builds only the game script (no page around it); art and audio over 16 KB become files published next to it (npm run artifact).
// LEARNING=1 builds the learning preview page (learning.html) the same way.
const artifact = process.env.ARTIFACT === '1';
const learning = process.env.LEARNING === '1';
/**
 * The Artifact publishes its art and audio as separate files next to the page (a single inlined
 * page grew past the 16 MB limit). Intro comic pages, big JPG/PNG paintings, ship as WebP there.
 */
function smallComic(): Plugin {
  return {
    name: 'small-comic',
    enforce: 'pre',
    load(id) {
      const [file, query] = id.split('?');
      if (!query?.includes('url') || !/[\\/]assets[\\/]comic[\\/].+\.(jpe?g|png)$/.test(file)) return null;
      // A real file, not stdout: the WebP muxer fills in its RIFF size by seeking back.
      const tmp = join(tmpdir(), `partshift-${basename(file)}.webp`);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-c:v', 'libwebp', '-quality', '82', tmp]);
      const ref = this.emitFile({ type: 'asset', name: `${basename(file).replace(/\.\w+$/, '')}.webp`, source: readFileSync(tmp) });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
  };
}

export default defineConfig({
  base: './',
  // The universe site's files are not part of the game preview.
  publicDir: artifact ? false : 'public',
  plugins: artifact ? [smallComic()] : [],
  // The Artifact and learning previews never send analytics, so Firebase Analytics stays out of their one-file builds.
  define: { __ANALYTICS__: JSON.stringify(!artifact && !learning), __CLOUD__: JSON.stringify(!artifact && !learning) },
  build: {
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: learning ? () => true : artifact ? 16384 : 4096,
    outDir: learning ? 'dist-learning' : artifact ? 'dist-artifact' : 'dist',
    rollupOptions: {
      input: learning
        ? resolve(__dirname, 'learning.html')
        : artifact
          ? { game: resolve(__dirname, 'src/main.ts') }
          : { main: resolve(__dirname, 'index.html'), play: resolve(__dirname, 'play/index.html'), mobile: resolve(__dirname, 'mobile/index.html') },
      // One file for the single-page builds: lazy chunks (Firebase) are folded into the main script.
      output: artifact || learning ? { inlineDynamicImports: true } : {},
    },
  },
});
