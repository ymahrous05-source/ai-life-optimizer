/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server Actions are used extensively (goal creation, voice capture,
  // habit logging, reflections) — enabled by default in Next.js 14+,
  // left explicit here for clarity.
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
