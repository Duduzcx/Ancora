import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zcx.ancora',
  appName: 'Nórica',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_norica',
      iconColor: '#34d399'
    },
    PushNotifications: {
      // Com o app aberto, os avisos dos amigos também aparecem.
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      backgroundColor: "#080D19",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    }
  },
  backgroundColor: '#020e10'
};

export default config;