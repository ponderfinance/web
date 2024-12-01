import type { PrivyClientConfig } from '@privy-io/react-auth'
import {bitkubChain, bitkubTestnetChain} from "@/app/constants/chains";

export const privyConfig: PrivyClientConfig = {
  defaultChain: bitkubChain,
  supportedChains: [bitkubChain, bitkubTestnetChain],
  loginMethods: ['wallet'],
  appearance: {
    theme: 'light',
  },
}
