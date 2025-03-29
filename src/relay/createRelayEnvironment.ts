import { Environment, Network, RecordSource, Store } from 'relay-runtime'

export function createRelayEnvironment() {
  return new Environment({
    network: Network.create({
      fetch: async (request: Request, variables: Record<string, unknown>) => {
        const resp = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: request.text,
            variables,
          }),
        })
        return await resp.json()
      },
    }),
    store: new Store(new RecordSource()),
  })
} 