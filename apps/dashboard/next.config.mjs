/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/db", "@repo/shared"],
  serverExternalPackages: ["@prisma/client", ".prisma/client", "googleapis"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
