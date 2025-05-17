// app/lib/relay/environment.ts
import { createRelayEnvironment } from '@/src/relay/createRelayEnvironment';
import { initializeRelayUpdaters } from '@/src/relay/initRelayUpdaters';
import { Environment } from 'relay-runtime';

let clientEnvironment: Environment | null = null;

/**
 * Get the Relay client environment, creating and initializing it if necessary
 * This is the main entry point for getting access to the Relay environment
 */
export function getClientEnvironment() {
  // In SSR context, return null
  if (typeof window === 'undefined') return null;

  // Create the environment once for the client if it doesn't exist
  if (!clientEnvironment) {
    // console.log('Creating and initializing Relay environment');
    clientEnvironment = createRelayEnvironment();
    
    // Initialize all store updaters for the registry
    // We do this here to ensure they're registered when the environment is first created
    initializeRelayUpdaters();
  }

  return clientEnvironment;
}
