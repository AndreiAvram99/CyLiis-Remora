/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@repo/db", "@repo/shared"],
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "googleapis",
    "pdfkit",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
