'use client'

import React, { useEffect, useState } from 'react'
import { graphql, useLazyLoadQuery } from 'react-relay'
import PriceChart from './PriceChart'

// Define the query to fetch token price chart data
const TokenPriceChartQuery = graphql`
  query StablecoinChartFixQuery(
    $tokenAddress: String!
    $timeframe: String!
    $limit: Int!
  ) {
    tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {
      time
      value
    }
  }
`

// Force-render chart component for stablecoins
export default function StablecoinChartFix({
  tokenAddress,
  tokenSymbol,
  timeframe = '1m'
}: {
  tokenAddress: string
  tokenSymbol: string
  timeframe?: string
}) {
  console.log(`[STABLECOIN-FIX] Rendering chart for ${tokenSymbol} (${tokenAddress})`);
  
  // Fetch token price chart data
  const data = useLazyLoadQuery(
    TokenPriceChartQuery,
    {
      tokenAddress,
      timeframe,
      limit: 100,
    },
    {
      fetchPolicy: 'network-only', // Always fetch fresh data
    }
  )

  const tokenPriceChart = data.tokenPriceChart;
  
  // Log the data received
  useEffect(() => {
    console.log(`[STABLECOIN-FIX] Received ${tokenPriceChart?.length || 0} data points`);
    if (tokenPriceChart && tokenPriceChart.length > 0) {
      console.log(`[STABLECOIN-FIX] First point: ${JSON.stringify(tokenPriceChart[0])}`);
      console.log(`[STABLECOIN-FIX] Last point: ${JSON.stringify(tokenPriceChart[tokenPriceChart.length - 1])}`);
    }
  }, [tokenPriceChart]);

  // If no data, show a message
  if (!tokenPriceChart || tokenPriceChart.length === 0) {
    return (
      <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        No chart data available for {tokenSymbol}
      </div>
    );
  }
  
  return (
    <div>
      <PriceChart
        data={tokenPriceChart}
        type="area"
        title={`${tokenSymbol} Price (Fallback Renderer)`}
        height={400}
        autoSize={true}
        // Disable all special stablecoin handling
        formatTooltip={(value) => `$${value.toFixed(4)}`}
      />
    </div>
  );
} 