import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['bcryptjs', 'jsonwebtoken', 'ws', 'bufferutil', 'utf-8-validate'],
}

export default nextConfig
