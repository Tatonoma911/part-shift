import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// base './' so the build works from any GitHub Pages sub-path.
// Pages: the universe site at / (site/), the game at /play (src/), and the bare full-screen game at /mobile (the Android app's start page).
// ARTIFACT=1 builds only the game script (no page around it) and inlines every image so it fits in one HTML file (npm run artifact).
// LEARNING=1 builds the learning preview page (learning.html) the same way.
const artifact = process.env.ARTIFACT === '1';
const learning = process.env.LEARNING === '1';
export default defineConfig({
  base: './',
  // The Artifact and learning previews never send analytics, so Firebase Analytics stays out of their one-file builds.
  define: { __ANALYTICS__: JSON.stringify(!artifact && !learning) },
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
    },
  },
});
