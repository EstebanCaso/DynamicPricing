/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      // Ensure Node scripts are bundled with the server functions on Vercel (app dir paths)
      '/app/api/python/run-amadeus-js/route': ['./scripts/**'],
      '/app/api/python/run-hotel-js/route': ['./scripts/**'],
      '/app/api/python/run-events-js/route': ['./scripts/**'],
      '/app/api/python/run-script/route': ['./scripts/**'],
      '/app/api/python/run-script-with-progress/route': ['./scripts/**'],
    },
  },
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
