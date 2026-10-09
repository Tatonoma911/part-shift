import { defineConfig } from 'vite';

// base './' so the build works from any GitHub Pages sub-path.
// ARTIFACT=1 inlines every image so the build fits in one HTML file (npm run artifact).
// LEARNING=1 builds the learning preview page (learning.html) the same way.
const artifact = process.env.ARTIFACT === '1';
const learning = process.env.LEARNING === '1';
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: artifact || learning ? () => true : 4096,
    outDir: learning ? 'dist-learning' : artifact ? 'dist-artifact' : 'dist',
    rollupOptions: learning ? { input: 'learning.html' } : undefined,
  },
});
