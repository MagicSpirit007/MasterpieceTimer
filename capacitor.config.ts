import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.masterpiecetimer.app',
  appName: '绘梦',
  webDir: 'dist',
  android: {
    // 首个版本锁定竖屏在原生清单中配置；此处保持默认
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 400,
      launchAutoHide: true,
      backgroundColor: '#101014',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#8a7a5c',
    },
  },
}

export default config
