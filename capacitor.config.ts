import type { CapacitorConfig } from '@capacitor/cli';

// Two ways to ship to the App Store / Play Store:
//  1. Bundle the static export (`npm run build:mobile`) — webDir: 'out'.
//  2. Point the native shell at your Vercel deployment by setting CAP_SERVER_URL,
//     so app updates ship instantly without store review.
const config: CapacitorConfig = {
  appId: 'com.jetlag.hideandseek',
  appName: 'Hide + Seek',
  webDir: 'out',
  ...(process.env.CAP_SERVER_URL ? { server: { url: process.env.CAP_SERVER_URL, cleartext: false } } : {}),
};

export default config;
