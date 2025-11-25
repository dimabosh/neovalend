/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  experimental: {
    esmExternals: true,
  },
  images: {
    domains: ['assets.coingecko.com', 'token-icons.s3.amazonaws.com'],
  },
};

export default nextConfig;