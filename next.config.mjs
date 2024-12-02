import path from 'path';

const nextConfig = {
    webpack: (config) => {
        // Add verbose output for debugging module resolution
        console.log('Webpack aliases:', config.resolve.alias);

        // Resolve `@ponderfinance/dex` manually if needed
        config.resolve.alias['@ponderfinance/dex'] = path.resolve(
            'node_modules/@ponderfinance/dex'
        );

        return config;
    },
    experimental: {
        esmExternals: 'loose', // Support for ESM dependencies
    },
};

export default nextConfig;
