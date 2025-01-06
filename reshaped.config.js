/** @type {import('reshaped').ReshapedConfig} */
const config = {
  themes: {
    ponder: {
      color: {
        foregroundPrimary: { hex: '#94E0FE' },
        backgroundPage: { hex: '#1E1E1E' },
        backgroundPrimary: { hex: '#94E0FE' },
        backgroundDisabled: { hex: '#2d4954' },
        backgroundElevationBase: { hex: '#202629' },
        backgroundElevationOverlay: { hex: '#212121' },
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
