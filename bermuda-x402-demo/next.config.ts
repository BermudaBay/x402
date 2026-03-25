import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Exclude Bermuda SDK from server-side webpack bundling
  // (SDK uses import.meta.dirname for circuit loading, which requires Node.js runtime)
  serverExternalPackages: [
    'bermuda-bay-sdk',
    '@aztec/bb.js',
    '@noir-lang/noir_js',
  ],

  // Ensure the vendored SDK and ALL its nested node_modules are included in the
  // serverless function bundle. Without this, Vercel's file tracer misses deps
  // that are only reachable via webpackIgnore dynamic imports.
  outputFileTracingIncludes: {
    '/api/bermuda-checkout':              ['./packages/**/*', './node_modules/@aztec/**/*', './node_modules/@noir-lang/**/*'],
    '/api/facilitator':                   ['./packages/**/*', './node_modules/@aztec/**/*', './node_modules/@noir-lang/**/*'],
    '/api/checkout':                      ['./packages/**/*', './node_modules/@aztec/**/*', './node_modules/@noir-lang/**/*'],
    '/api/faucet':                        ['./packages/**/*', './node_modules/@aztec/**/*', './node_modules/@noir-lang/**/*'],
  },

  // Note: bb.js / ZK proof work runs in Node API routes only (see bermuda-client + bermuda-checkout).
  // Do not set Cross-Origin-Embedder-Policy on the HTML document — it can prevent stylesheets
  // and other assets from applying in some browsers/setups (unstyled “collapsed” UI).

  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:     false,
        path:   false,
        crypto: false,
      }
    } else {
      // Server: mark bermuda-bay-sdk and heavy ZK deps as externals
      const originalExternals = config.externals
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : originalExternals ? [originalExternals] : []),
        ({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
          // Note: bermuda-bay-sdk and @aztec/* are ESM packages with top-level await.
          // They must NOT be marked as 'commonjs' externals — require() cannot load
          // ESM modules with top-level await. Instead they are excluded from webpack
          // bundling via serverExternalPackages above and loaded via native import()
          // at runtime using /* webpackIgnore: true */ in the route handler.
          if (
            request &&
            (request.startsWith('@noir-lang/') ||
              request.includes('/sdk/build/') ||
              request.includes('/sdk/src/'))
          ) {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        },
      ]
    }
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    return config
  },
}

export default nextConfig
