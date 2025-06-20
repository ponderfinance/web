import type { Config } from 'tailwindcss'
import { getTheme } from 'reshaped/config/tailwind'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    ...getTheme(),
    extend: {},
  },
  plugins: [],
}
export default config
