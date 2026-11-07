/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdf-parse 與 mammoth 為 Node 端套件，不打包進 bundle
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "mammoth"],
  },
};

export default nextConfig;
