import { defineConfig } from 'vitest/config'
import path from 'path'
import { readFileSync } from 'fs'

function loadDotenv(file: string): Record<string, string> {
  try {
    const vars: Record<string, string> = {}
    for (const line of readFileSync(file, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m) vars[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
    }
    return vars
  } catch {
    return {}
  }
}

const env = loadDotenv(path.resolve(__dirname, '../../.env'))

export default defineConfig({
  resolve: {
    alias: {
      '@/app': path.resolve(__dirname, './app'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/test/api/**/*.test.ts'],
    globals: true,
    env: {
      DATABASE_URL: env.TEST_DATABASE_URL ?? env.DATABASE_URL ?? '',
      APP_DATABASE_URL: env.TEST_DATABASE_URL ?? env.DATABASE_URL ?? '',
      JWT_SECRET: env.JWT_SECRET ?? 'test-secret',
    },
  },
})
