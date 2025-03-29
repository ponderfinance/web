import { Environment, Network, RecordSource, Store, FetchFunction } from 'relay-runtime'

const fetchRelay: FetchFunction = async (params, variables) => {
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

// Create a network layer using our fetchRelay function
const network = Network.create(fetchRelay)

// Create a store to cache the data
const source = new RecordSource()
const store = new Store(source)

let clientEnvironment: Environment | undefined

export function createRelayEnvironment() {
  // For SSR, always create a new environment
  if (typeof window === 'undefined') return null

  // Create the environment once for the client
  if (!clientEnvironment) {
    clientEnvironment = new Environment({
      network,
      store,
      isServer: false,
    })
  }

  return clientEnvironment
} 