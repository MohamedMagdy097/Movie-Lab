/** @type {import('next').NextConfig} */
const nextConfig = {
  serverRuntimeConfig: {
    // Will only be available on the server side
    maxBodySize: '10mb',
  },
  experimental: {
    serverActions: {
      enabled: true
    }
  },
  serverExternalPackages: ['sharp', 'canvas'],
}

module.exports = nextConfig
