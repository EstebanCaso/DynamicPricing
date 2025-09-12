/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable API routes for Python script integration
  async rewrites() {
    return [
      {
        source: '/api/python/:path*',
        destination: '/api/python-handler/:path*',
      },
    ];
  },
}

export default nextConfig
