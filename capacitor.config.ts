import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // appId bleibt unverändert, damit Updates über die installierte App gehen
  appId: 'com.sprintene.sprinter',
  appName: 'Sprintende Sprinter',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_sprinter',
      iconColor: '#EE4F17',
    },
    // Prüft etwa alle 15 Minuten im Hintergrund Verspätungen, Ausfälle und Gleiswechsel
    BackgroundRunner: {
      label: 'de.sprintende.trains',
      src: 'runners/background.js',
      event: 'checkTrains',
      repeat: true,
      interval: 15,
      autoStart: true,
    },
  },
};

export default config;
