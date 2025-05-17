import path from 'path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: false,
  
  // Disable TypeScript checking during build
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  
  // Disable ESLint during build
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  transpilePackages: ['@radix-ui'],
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

    // Fix issues with AsyncLocalStorage
    config.externals.push({ 'async_hooks': 'commonjs async_hooks' });

    return config
  },
  experimental: {
    esmExternals: true, // Required for chart.js
    // serverComponentsExternalPackages: ['@prisma/client'],
  },
}

export default nextConfig
