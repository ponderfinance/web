import type { PrivyClientConfig } from '@privy-io/react-auth'
import {
  bitkubChain,
  bitkubTestnetChain,
  CURRENT_CHAIN,
} from '@/src/app/constants/chains'

export const privyConfig: PrivyClientConfig = {
  defaultChain: bitkubChain,
  supportedChains: [bitkubChain],
  loginMethods: ['wallet'],
  appearance: {
    theme: 'dark',
  },
}
