import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fully static export — deployable to Nginx / S3 / GitHub Pages / any CDN.
  // No Next.js server, no API routes, no middleware at runtime.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
