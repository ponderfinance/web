import { resolve } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from 'reshaped/config/postcss';

// Simulate __dirname in ES module scope
const __dirname = dirname(fileURLToPath(import.meta.url));

const config = getConfig({
  themeMediaCSSPath: resolve(__dirname, './src/themes/ponder/media.css'),
});

export default {
  ...config,
  plugins: {
    ...config.plugins,
    tailwindcss: {},
    autoprefixer: {},
  },
};
