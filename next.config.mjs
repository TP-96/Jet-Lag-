/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `npm run build:mobile` produces a static bundle in /out for Capacitor (iOS/Android).
  // Vercel uses the normal build.
  ...(process.env.MOBILE_EXPORT ? { output: 'export', trailingSlash: true, images: { unoptimized: true } } : {}),
};

export default nextConfig;
