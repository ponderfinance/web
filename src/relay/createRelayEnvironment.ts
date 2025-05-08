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
      const data = JSON.parse(event.data);
      console.log(`Subscription event received for ${operationName}:`, data);

      if (data.type === 'connection_ack') {
        console.log(`Subscription connection acknowledged for ${operationName}`);
      } else if (data.type === 'next') {
        // When we receive data, we need to fetch the complete data with a standard query
        Promise.resolve(fetchQuery(request, variables, {}, null))
          .then((response: any) => {
            sink.next(response as GraphQLResponse);
          })
          .catch((error: any) => {
            console.error('Error fetching data after subscription event:', error);
            sink.error(error instanceof Error ? error : new Error(String(error)));
          });
      } else if (data.type === 'error') {
        sink.error(new Error(data.payload.message));
      } else if (data.type === 'complete') {
        sink.complete();
      }
    };

    // Handle errors
    eventSource.onerror = (error: Event) => {
      console.error(`Subscription error for ${operationName}:`, error);
      sink.error(new Error('EventSource error'));
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