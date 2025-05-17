import { 
  Environment, 
  Network, 
  RecordSource, 
  Store, 
  Observable,
  FetchFunction,
  SubscribeFunction,
  RequestParameters,
  Variables,
  GraphQLResponse,
  RecordSourceProxy,
  RecordProxy
} from 'relay-runtime'

// Store updater registry for efficient updates
interface StoreUpdater {
  pattern: RegExp;
  updater: (store: RecordSourceProxy, data: any) => void;
}

// Registry of store updaters for different entity types
const storeUpdaters: StoreUpdater[] = [];

/**
 * Register a store updater for a specific query pattern
 * This helps optimize updates by making targeted changes instead of refetching
 */
export function registerStoreUpdater(
  pattern: RegExp,
  updater: (store: RecordSourceProxy, data: any) => void
): void {
  storeUpdaters.push({ pattern, updater });
}

/**
 * Apply store update for a specific entity type and data
 * Returns true if an updater was found and applied
 */
export function applyStoreUpdate(
  entityType: string,
  data: any,
  environment: Environment
): boolean {
  // See if we have a registered updater for this entity type
  const matchingUpdater = storeUpdaters.find(entry => entry.pattern.test(entityType));
  
  if (matchingUpdater) {
    // If we have an updater, use it to make targeted store changes
    environment.commitUpdate(store => {
      matchingUpdater.updater(store, data);
    });
    return true;
  }
  
  return false;
}

// Function to fetch query data from GraphQL API
const fetchQuery: FetchFunction = async (
  params: RequestParameters,
  variables: Variables
) => {
  // URL for our GraphQL API endpoint
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: params.text,
      variables,
    }),
  })

  // Get the response as JSON
  const json = await response.json()

  // GraphQL errors can be returned in successful responses, check for those
  if (Array.isArray(json.errors) && json.errors.length > 0) {
    console.error('Error from GraphQL:', json.errors)
    throw new Error(
      `Error fetching GraphQL query '${params.name}' with variables ${JSON.stringify(
        variables
      )}: ${JSON.stringify(json.errors)}`
    )
  }

  return json
}

// Define message handler types
interface MessageHandler {
  matcher: (operationName: string | null | undefined, variables: Variables) => boolean;
  handler: (
    data: any, 
    environment: Environment | undefined, 
    request: RequestParameters, 
    variables: Variables, 
    sink: any
  ) => void;
}

// Registry of message handlers for different message types
const messageHandlerRegistry: Record<string, MessageHandler> = {
  'metrics:updated': {
    matcher: () => true, // Process all metrics updates
    handler: (data, environment, request, variables, sink) => {
      console.log(`Received metrics update for ${request.name}:`, data.payload);
      
      // Try direct store update first
      let updated = false;
      if (environment) {
        updated = applyStoreUpdate('global-metrics', data.payload, environment);
        if (updated) {
          console.log('Applied direct store update for global metrics');
        }
      }
      
      // Fall back to refetch if direct update failed or not possible
      if (!updated) {
        Observable.from(fetchQuery(request, variables, {}))
          .subscribe({
            next: (response) => {
              console.log(`Fetched updated data for ${request.name}`);
              sink.next(response);
            },
            error: (error: any) => {
              console.error(`Error fetching updated data:`, error);
              sink.error(error instanceof Error ? error : new Error(String(error)));
            }
          });
      }
    }
  },
  
  'pair:updated': {
    matcher: (operationName, variables) => {
      if (!operationName) return false;
      return operationName.toLowerCase().includes('pair') && 
        !!variables?.pairId;
    },
    handler: (data, environment, request, variables, sink) => {
      console.log(`Received pair update for ${request.name}:`, data.payload);
      
      // Try direct store update first
      let updated = false;
      if (environment && data.payload?.entityId) {
        updated = applyStoreUpdate(`pair-${data.payload.entityId}`, data.payload, environment);
        if (updated) {
          console.log(`Applied direct store update for pair ${data.payload.entityId}`);
        }
      }
      
      // Fall back to refetch if direct update failed
      if (!updated) {
        Observable.from(fetchQuery(request, variables, {}))
          .subscribe({
            next: (response) => sink.next(response),
            error: (error: any) => sink.error(error instanceof Error ? error : new Error(String(error)))
          });
      }
    }
  },
  
  'token:updated': {
    matcher: (operationName, variables) => {
      if (!operationName) return false;
      return operationName.toLowerCase().includes('token') && 
        (!!variables?.tokenId || !!variables?.tokenAddress);
    },
    handler: (data, environment, request, variables, sink) => {
      console.log(`Received token update for ${request.name}:`, data.payload);
      
      // Try direct store update first
      let updated = false;
      if (environment && data.payload?.entityId) {
        updated = applyStoreUpdate(`token-price-${data.payload.entityId}`, data.payload, environment);
        if (updated) {
          console.log(`Applied direct store update for token ${data.payload.entityId}`);
        }
      }
      
      // Fall back to refetch if direct update failed
      if (!updated) {
        Observable.from(fetchQuery(request, variables, {}))
          .subscribe({
            next: (response) => sink.next(response),
            error: (error: any) => sink.error(error instanceof Error ? error : new Error(String(error)))
          });
      }
    }
  },
  
  'transaction:updated': {
    matcher: (operationName) => {
      if (!operationName) return false;
      return operationName.toLowerCase().includes('transaction');
    },
    handler: (data, environment, request, variables, sink) => {
      console.log(`Received transaction update for ${request.name}:`, data.payload);
      
      // Try store update first (when transaction updater is registered)
      let updated = false;
      if (environment && data.payload?.entityId) {
        updated = applyStoreUpdate(`transaction-${data.payload.entityId}`, data.payload, environment);
        if (updated) {
          console.log(`Applied direct store update for transaction ${data.payload.entityId}`);
        }
      }
      
      // If direct update failed, try targeted invalidation
      if (!updated && environment) {
        try {
          environment.commitUpdate(store => {
            const root = store.getRoot();
            // Look for the transactions connection
            const transactionsConnection = root.getLinkedRecord('recentTransactions');
            if (transactionsConnection) {
              // Mark for store changes instead of invalidation
              console.log('Marking transactions for refetch');
              // Need to manually refetch since we can't invalidate directly
            }
          });
        } catch (error) {
          console.error('Error updating store:', error);
        }
      }
      
      // As last resort, do a full refetch
      Observable.from(fetchQuery(request, variables, {}))
        .subscribe({
          next: (response) => {
            console.log(`Fetched updated transaction data for ${request.name}`);
            sink.next(response);
          },
          error: (error: any) => {
            console.error(`Error fetching updated transaction data:`, error);
            sink.error(error instanceof Error ? error : new Error(String(error)));
          }
        });
    }
  }
};

// Create a subscription handler using Server-Sent Events
const createSubscription: SubscribeFunction = (
  request: RequestParameters,
  variables: Variables
) => {
  return Observable.create<GraphQLResponse>(sink => {
    // Get operation name to be sent to the server
    const operationName = request.name;
    console.log(`Setting up subscription for operation: ${operationName}`, variables);

    // Create EventSource for SSE connection
    const eventSource = new EventSource(`/api/graphql-subscription`, {
      withCredentials: true,
    });

    // Send initial request with POST
    fetch('/api/graphql-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operationName,
        variables,
      }),
    }).catch(error => {
      console.error('Error sending subscription request:', error);
      sink.error(error instanceof Error ? error : new Error(String(error)));
    });

    // Handle connection open
    eventSource.onopen = () => {
      console.log(`Subscription connection opened for ${operationName}`);
    };

    // Handle incoming messages with improved handler system
    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        
        // Special case for system messages
        if (data.type === 'connected') {
          console.log(`SSE connection established for ${operationName}`);
          return;
        } else if (data.type === 'error') {
          sink.error(new Error(data.payload?.message || 'Unknown subscription error'));
          return;
        } else if (data.type === 'complete') {
          sink.complete();
          return;
        }
        
        // Get the handler from the registry
        const handlerConfig = messageHandlerRegistry[data.type];
        
        // Use the handler if available and matches the current operation
        if (handlerConfig && handlerConfig.matcher(operationName, variables)) {
          handlerConfig.handler(data, clientEnvironment, request, variables, sink);
        } else if (data.type === 'next') {
          // Legacy handling for older style messages
          Observable.from(fetchQuery(request, variables, {}))
            .subscribe({
              next: (response) => sink.next(response),
              error: (error: any) => sink.error(error instanceof Error ? error : new Error(String(error)))
            });
        } else {
          console.log(`No handler for message type: ${data.type} for operation: ${operationName}`);
        }
      } catch (error) {
        console.error(`Error processing subscription message for ${operationName}:`, error);
        // Don't terminate the subscription on a single message error
      }
    };

    // Handle errors
    eventSource.onerror = (error: Event) => {
      console.error(`Subscription error for ${operationName}:`, error);
      
      // Don't terminate the subscription on connection error
      // The browser will automatically try to reconnect
      
      // Only report the error, don't close the stream
      console.error('EventSource error, will try to reconnect automatically');
    };

    // Return cleanup function
    return () => {
      console.log(`Cleaning up subscription for ${operationName}`);
      eventSource.close();
    };
  });
};

// Create a network layer with fetch and subscribe functions
const network = Network.create(fetchQuery, createSubscription);

// Create a store to cache the data
const source = new RecordSource();
const store = new Store(source, {
  // Enable garbage collection to free up memory
  gcReleaseBufferSize: 10
});

let clientEnvironment: Environment | undefined;

export function createRelayEnvironment() {
  // For SSR, always create a new environment
  if (typeof window === 'undefined') return null;

  // Create the environment once for the client
  if (!clientEnvironment) {
    clientEnvironment = new Environment({
      network,
      store,
      isServer: false,
    });
  }

  return clientEnvironment;
}

// Register transaction list updater
export function registerTransactionListUpdater() {
  registerStoreUpdater(
    /^transaction-/,
    (store, data) => {
      try {
        // Get transaction ID from the data
        const transactionId = data.entityId;
        if (!transactionId) return;
        
        // Find the root and connections
        const root = store.getRoot();
        const connectionsRecord = root.getLinkedRecord('recentTransactions');
        
        if (!connectionsRecord) {
          console.log('No transactions connection found in store');
          return;
        }
        
        // Update specific transaction if it exists in the store
        const transactionRecord = store.get(transactionId);
        if (transactionRecord) {
          // Update specific fields if they exist in the data
          if (data.valueUSD !== undefined) {
            transactionRecord.setValue(data.valueUSD, 'valueUSD');
          }
          
          console.log(`Updated transaction ${transactionId} in Relay store without refetching`);
        } else {
          // Transaction not in store yet, need refetch (can't use invalidateRecord directly)
          console.log(`Transaction ${transactionId} not found in store, will need a refetch`);
          // Store a flag to indicate we need to refetch this data on next query
        }
      } catch (error) {
        console.error('Error updating transaction in store:', error);
      }
    }
  );
}

// Example token price updater (can be registered from components)
export function registerTokenPriceUpdater() {
  registerStoreUpdater(
    /^token-price-/,
    (store, data) => {
      // Get token ID from the data
      const tokenId = data.entityId;
      if (!tokenId) return;
      
      // Find the token record
      const tokenRecord = store.get(tokenId);
      if (!tokenRecord) return;
      
      // Update price fields
      if (data.priceUSD !== undefined) {
        tokenRecord.setValue(data.priceUSD, 'priceUSD');
      }
      
      if (data.priceChange24h !== undefined) {
        tokenRecord.setValue(data.priceChange24h, 'priceChange24h');
      }
      
      if (data.priceChange1h !== undefined) {
        tokenRecord.setValue(data.priceChange1h, 'priceChange1h');
      }
      
      console.log(`Updated token ${tokenId} price in Relay store without refetching`);
    }
  );
} 