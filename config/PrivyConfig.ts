import type { PrivyClientConfig } from '@privy-io/react-auth'
import { bitkubChain, bitkubTestnetChain } from '@/src/app/constants/chains'

export const privyConfig: PrivyClientConfig = {
  defaultChain: bitkubTestnetChain,
  supportedChains: [bitkubChain, bitkubTestnetChain],
  loginMethods: ['wallet'],
  appearance: {
    theme: 'light',
  },
}
