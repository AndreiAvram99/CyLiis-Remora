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
  experimental: {
    // A print request is a batch of models sent through a server action, and the
    // 1 MB default would reject all but the smallest.
    serverActions: { bodySizeLimit: "60mb" },
  },
};

export default nextConfig;
