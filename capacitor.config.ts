import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mjscoreboard.app',
  appName: '国标麻将实时计分板',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  android: {
    overScrollMode: 'never'
  }
};

export default config;
