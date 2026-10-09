import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// base './' so the build works from any GitHub Pages sub-path.
// Pages: the universe site at / (site/), the game at /play (src/), and the bare full-screen game at /mobile (the Android app's start page).
// ARTIFACT=1 builds only the game script (no page around it) and inlines every image so it fits in one HTML file (npm run artifact).
// LEARNING=1 builds the learning preview page (learning.html) the same way.
const artifact = process.env.ARTIFACT === '1';
const learning = process.env.LEARNING === '1';
/**
 * The Artifact must stay under 16 MB, so its audio is re-encoded to mono at a low
 * bit rate (the orchestral tracks are ~10 MB at full quality). Pages and the APK keep the originals.
 */
function smallMusic(): Plugin {
  return {
    name: 'small-music',
    enforce: 'pre',
    load(id) {
      const [file, query] = id.split('?');
      const kind = /[\\/]audio[\\/](music|sfx)[\\/][^\\/]+\.mp3$/.exec(file)?.[1];
      if (!query?.includes('url') || !kind) return null;
      const rate = kind === 'music' ? '40k' : '48k';
      const out = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-b:a', rate, '-f', 'mp3', '-'], { maxBuffer: 64 << 20 });
      return `export default ${JSON.stringify(`data:audio/mpeg;base64,${out.toString('base64')}`)};`;
    },
  };
}

export default defineConfig({
  base: './',
  plugins: artifact ? [smallMusic()] : [],
  // The Artifact and learning previews never send analytics, so Firebase Analytics stays out of their one-file builds.
  define: { __ANALYTICS__: JSON.stringify(!artifact && !learning), __CLOUD__: JSON.stringify(!artifact && !learning) },
  build: {
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: artifact || learning ? () => true : 4096,
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
