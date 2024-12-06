import path from 'path'

const nextConfig = {
  webpack: (config) => {
    // Resolve `@ponderfinance/dex` manually if needed
    config.resolve.alias['@ponderfinance/dex'] = path.resolve(
      'node_modules/@ponderfinance/dex'
    )

    return config
  },
  transpilePackages: ['reshaped'],
  experimental: {
    optimizePackageImports: ['reshaped'],
    esmExternals: 'loose', // Support for ESM dependencies
  },
}

export default nextConfig
