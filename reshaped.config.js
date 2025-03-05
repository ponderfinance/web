/** @type {import('reshaped').ReshapedConfig} */
const config = {
  themes: {
    ponder: {
      color: {
        foregroundPrimary: { hex: '#94E0FE' },
        foregroundNeutralFaded: { hex: '#6e787d' },
        backgroundPage: { hex: '#1E1E1E' },
        backgroundPrimary: { hex: '#94E0FE' },
        backgroundDisabled: { hex: '#2d4954' },
        backgroundElevationBase: { hex: '#212528' },
        backgroundElevationOverlay: { hex: '#212121' },
        backgroundNeutral: { hex: '#2a2c30' },
        backgroundNeutralFaded: { hex: '#272829' },
      },
      radius: {
        small: { px: 8 },
        medium: { px: 12 },
        large: { px: 16 },
      },
      viewport: {
        m: { minPx: 660 },
        l: { minPx: 900 },
        xl: { minPx: 1280 },
        s: { maxPx: 659 },
      },
    },
  },
}

module.exports = config
