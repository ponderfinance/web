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

    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      dns: false,
      net: false,
      tls: false,
      child_process: false,
    }

    return config
  },
  // Keep your existing transpilePackages and add problematic ones
  transpilePackages: ['reshaped', '@tanstack/query-core', '@tanstack/react-query'],
  experimental: {
    optimizePackageImports: ['reshaped'],
    esmExternals: 'loose', // Support for ESM dependencies
    largeModuleExclude: [/@privy-io\/react-auth/],
  },
  // Disable SWC minify
  swcMinify: false,
}

export default nextConfig
