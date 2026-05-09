import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', '@schedule-core/db', '@neondatabase/serverless', 'ws', 'bufferutil', 'utf-8-validate'],
}

export default nextConfig
