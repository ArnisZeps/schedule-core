import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', '@neondatabase/serverless', 'ws', 'bufferutil', 'utf-8-validate'],
}

export default nextConfig
