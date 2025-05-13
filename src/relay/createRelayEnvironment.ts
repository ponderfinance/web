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
  GraphQLResponse
} from 'relay-runtime'

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

    // Handle incoming messages
    eventSource.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected') {
          console.log(`SSE connection established for ${operationName}`);
        }
        // Handle metrics updates
        else if (data.type === 'metrics:updated') {
          console.log(`Received metrics update for ${operationName}:`, data.payload);
          
          // For GraphQL subscriptions, we need to trigger a query to fetch the latest data
          // This is simpler than trying to reconstruct the subscription payload
          Observable.from(fetchQuery(request, variables, {}))
            .subscribe({
              next: (response) => {
                console.log(`Fetched updated data for ${operationName}:`, response);
                sink.next(response);
              },
              error: (error: any) => {
                console.error(`Error fetching updated data for ${operationName}:`, error);
                sink.error(error instanceof Error ? error : new Error(String(error)));
              }
            });
        }
        // Handle pair updates
        else if (data.type === 'pair:updated' && 
                 operationName?.toLowerCase().includes('pair') && 
                 variables?.pairId === data.payload?.entityId) {
          console.log(`Received pair update for ${operationName}:`, data.payload);
          Observable.from(fetchQuery(request, variables, {}))
            .subscribe({
              next: (response) => {
                sink.next(response);
              },
              error: (error: any) => {
                sink.error(error instanceof Error ? error : new Error(String(error)));
              }
            });
        }
        // Handle token updates
        else if (data.type === 'token:updated' && 
                 operationName?.toLowerCase().includes('token') && 
                 variables?.tokenId === data.payload?.entityId) {
          console.log(`Received token update for ${operationName}:`, data.payload);
          Observable.from(fetchQuery(request, variables, {}))
            .subscribe({
              next: (response) => {
                sink.next(response);
              },
              error: (error: any) => {
                sink.error(error instanceof Error ? error : new Error(String(error)));
              }
            });
        }
        // Legacy handling for older style messages
        else if (data.type === 'next') {
          Observable.from(fetchQuery(request, variables, {}))
            .subscribe({
              next: (response) => {
                sink.next(response);
              },
              error: (error: any) => {
                sink.error(error instanceof Error ? error : new Error(String(error)));
              }
            });
        }
        else if (data.type === 'error') {
          sink.error(new Error(data.payload?.message || 'Unknown subscription error'));
        }
        else if (data.type === 'complete') {
          sink.complete();
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
const store = new Store(source);

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