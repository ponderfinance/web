import type { PrivyClientConfig } from '@privy-io/react-auth'
import { baseSepolia } from 'viem/chains'

export const privyConfig: PrivyClientConfig = {
  defaultChain: baseSepolia,
  supportedChains: [baseSepolia],
  loginMethods: ['wallet'],
  appearance: {
    showWalletLoginFirst: false,
    theme: 'light',
  },
}
