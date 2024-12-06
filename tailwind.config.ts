import type { Config } from 'tailwindcss'
import { getTheme } from 'reshaped/config/tailwind'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    ...getTheme(),
    extend: {},
  },
  plugins: [],
}
export default config
