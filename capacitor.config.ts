import type { CapacitorConfig } from '@capacitor/cli';

// Android shell around the web build (npm run android:sync copies dist/ into android/).
const config: CapacitorConfig = {
  appId: 'com.partshift.game',
  appName: 'Part Shift',
  webDir: 'dist',
  backgroundColor: '#dfeef3',
  plugins: {
    // Edge-to-edge WebView; real insets arrive as --safe-area-inset-* CSS variables (used in index.html).
    SystemBars: { insetsHandling: 'css' },
  },
};

export default config;
