/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // 避免 webpack 打包 undici 导致其原生 net/tls 连接行为异常
    serverComponentsExternalPackages: ["undici"],
  },
};

export default nextConfig;
