// Override to force specific values
export function patchResolver(app) {
  // Override the GraphQL resolver for protocolMetrics
  app.use('/api/graphql', (req, res, next) => {
    // Check if this is a protocol metrics query
    if (req.body && req.body.query && req.body.query.includes('protocolMetrics')) {
      console.log('Intercepting protocolMetrics GraphQL query');
      
      // Send our fixed values
      res.json({
        data: {
          protocolMetrics: {
            id: "redis-metrics",
            dailyVolumeUSD: "7.562920431582284",
            totalValueLockedUSD: "3.00",
            volume24hChange: 160.2177537136986,
            weeklyVolumeUSD: "0",
            monthlyVolumeUSD: "0"
          }
        }
      });
      return;
    }
    next();
  });
};