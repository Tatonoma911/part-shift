import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// base './' so the build works from any GitHub Pages sub-path.
// Two pages: the universe site at / (site/) and the game at /play (src/).
// ARTIFACT=1 builds only the game script (no page around it) and inlines every image so it fits in one HTML file (npm run artifact).
const artifact = process.env.ARTIFACT === '1';
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: artifact ? () => true : 4096,
    outDir: artifact ? 'dist-artifact' : 'dist',
    rollupOptions: {
      input: artifact ? { game: resolve(__dirname, 'src/main.ts') } : { main: resolve(__dirname, 'index.html'), play: resolve(__dirname, 'play/index.html') },
    },
  },
});
