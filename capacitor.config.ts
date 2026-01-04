import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.archerio.arrowgame',
  appName: 'Arrow Game',
  webDir: 'dist',
  server: {
    // For development, you can use a live reload URL
    // url: 'http://192.168.1.x:3000',
    // cleartext: true,
  },
  ios: {
    // Disable default iOS scroll behavior for game
    scrollEnabled: false,
    // Allow inline media playback
    allowsLinkPreview: false,
  },
  android: {
    // Keep screen on during gameplay
    // Requires adding <uses-permission android:name="android.permission.WAKE_LOCK" /> to AndroidManifest.xml
  },
  plugins: {
    Haptics: {
      // Haptics plugin configuration (uses defaults)
    },
  },
}

export default config
