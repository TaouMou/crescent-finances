import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.crescentfinances.app',
  appName: 'Crescent Finances',
  webDir: 'dist',
  server: {
    // https scheme required for Web Crypto API (secure context)
    androidScheme: 'https',
  },
};

export default config;
