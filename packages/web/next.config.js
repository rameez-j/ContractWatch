/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/trpc/:path*',
        destination: 'http://localhost:3000/trpc/:path*',
      },
    ];
  },
};

module.exports = nextConfig; 