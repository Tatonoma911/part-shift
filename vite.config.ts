import { defineConfig } from 'vite';

// base './' so the build works from any GitHub Pages sub-path.
// ARTIFACT=1 inlines every image so the build fits in one HTML file (npm run artifact).
const artifact = process.env.ARTIFACT === '1';
export default defineConfig({
  base: './',
  build: {
    chunkSizeWarningLimit: 4000,
    assetsInlineLimit: artifact ? () => true : 4096,
    outDir: artifact ? 'dist-artifact' : 'dist',
    // One file for the artifact: lazy chunks (Firebase) are folded into the main script.
    rollupOptions: artifact ? { output: { inlineDynamicImports: true } } : {},
  },
});
