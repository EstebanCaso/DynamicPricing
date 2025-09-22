/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      // Ensure Node scripts are bundled with the server functions on Vercel
      '/src/app/api/python/run-amadeus-js/route.ts': ['./scripts/**'],
      '/src/app/api/python/run-hotel-js/route.ts': ['./scripts/**'],
      '/src/app/api/python/run-events-js/route.ts': ['./scripts/**'],
      '/src/app/api/python/run-script/route.ts': ['./scripts/**'],
      '/src/app/api/python/run-script-with-progress/route.ts': ['./scripts/**'],
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
