import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.CODESPACE_NAME
    ? {
        experimental: {
          serverActions: {
            allowedOrigins: ["localhost:3000"],
          },
        },
      }
    : {}),
};

export default nextConfig;
