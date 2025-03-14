import path from 'path'

const nextConfig = {
  webpack: (config) => {
    // Resolve `@ponderfinance/dex` manually if needed
    config.resolve.alias['@ponderfinance/dex'] = path.resolve(
      'node_modules/@ponderfinance/dex'
    )

    // Avoid the path undefined error
    config.module.rules.unshift({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    })

    return config
  },
  // Keep your existing transpilePackages and add problematic ones
  transpilePackages: ['reshaped', '@tanstack/query-core', '@tanstack/react-query'],
  experimental: {
    optimizePackageImports: ['reshaped'],
    esmExternals: 'loose', // Support for ESM dependencies
  },
  // Disable SWC minify
  swcMinify: false,
}

export default nextConfig
