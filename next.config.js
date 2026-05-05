/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',       // nadal wspierane w Next 15
  poweredByHeader: false,
  compress: true,

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        util: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
