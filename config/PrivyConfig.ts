import type { PrivyClientConfig } from '@privy-io/react-auth'
import { baseSepolia, base } from 'viem/chains'

export const privyConfig: PrivyClientConfig = {
  defaultChain: baseSepolia,
  supportedChains: [baseSepolia, base],
  loginMethods: ['wallet'],
  appearance: {
    theme: 'light',
  },
}
