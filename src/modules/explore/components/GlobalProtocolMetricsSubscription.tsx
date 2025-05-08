import React, { useEffect } from 'react';
import { graphql, useSubscription } from 'react-relay';
import { useQueryLoader } from 'react-relay';
import { GlobalProtocolMetricsQuery } from '@/src/__generated__/GlobalProtocolMetricsQuery.graphql';
import type { GlobalProtocolMetricsSubscription } from '@/src/__generated__/GlobalProtocolMetricsSubscription.graphql';
import GlobalProtocolMetrics, { globalProtocolMetricsQuery } from './GlobalProtocolMetrics';

// Define the GraphQL subscription
const protocolMetricsSubscription = graphql`
  subscription GlobalProtocolMetricsSubscription {
    protocolMetricsUpdated {
      dailyVolumeUSD
      totalValueLockedUSD
      volume1hChange
      volume24hChange
    }
  }
`;

export default function GlobalProtocolMetricsWithSubscription() {
  // Get query reference for Relay
  const [queryRef, loadQuery] = useQueryLoader<GlobalProtocolMetricsQuery>(
    globalProtocolMetricsQuery
  );

  // Set up the subscription config
  const config = {
    subscription: protocolMetricsSubscription,
    variables: {},
    onNext: () => {
      // When subscription delivers an update, reload the query
      console.log('Protocol metrics subscription received an update');
      loadQuery({}, { fetchPolicy: 'network-only' });
    },
    onError: (error: Error) => {
      console.error('Protocol metrics subscription error:', error);
    }
  };

  // Start the subscription
  useSubscription<GlobalProtocolMetricsSubscription>(config);

  // Load the initial data
  useEffect(() => {
    loadQuery({}, { fetchPolicy: 'network-only' });
  }, [loadQuery]);

  // Render the metrics component with the query reference
  return queryRef ? (
    <GlobalProtocolMetrics queryRef={queryRef} />
  ) : (
    <div>Loading protocol metrics...</div>
  );
} 