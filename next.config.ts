import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
    ],
  },
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/monitors/check": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/cron/check": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
};

export default nextConfig;
