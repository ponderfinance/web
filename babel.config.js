module.exports = {
  presets: [
    [
      'next/babel',
      {
        'preset-env': {
          targets: {
            browsers: ['last 2 versions', 'not dead', 'not < 2%'],
          },
        },
      },
    ],
  ],
  plugins: [
    'relay',
    '@babel/plugin-transform-private-methods',
    '@babel/plugin-transform-private-property-in-object',
  ],
  overrides: [
    {
      include: './node_modules/@privy-io/react-auth',
      compact: false,
    }
  ]
}
