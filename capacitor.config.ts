import type { CapacitorConfig } from "@capacitor/cli";
import dotenv from "dotenv";

dotenv.config();

const devServerUrl = process.env.CAPACITOR_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.auraArcher.app",
  appName: "Aura Archer",
  webDir: "dist",
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#000000",
      showSpinner: false,
      launchAutoHide: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#000000",
    },
  },
  // Live reload: set CAPACITOR_DEV_SERVER_URL in .env (e.g., http://192.168.1.100:3000)
  ...(devServerUrl && {
    server: {
      url: devServerUrl,
      cleartext: true,
    },
  }),
};

export default config;
