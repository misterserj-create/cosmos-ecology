import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.185-125-103-160.sslip.io',
      },
    ],
  },
};

export default nextConfig;
