// app/lib/relay/environment.ts
import { createRelayEnvironment } from '@/src/relay/createRelayEnvironment';
import { Environment } from 'relay-runtime';

let clientEnvironment: Environment | null = null;

export function getClientEnvironment() {
  if (typeof window === 'undefined') return null;

  // Use the createRelayEnvironment function which includes subscription support
  if (!clientEnvironment) {
    clientEnvironment = createRelayEnvironment();
  }

  return clientEnvironment;
}
