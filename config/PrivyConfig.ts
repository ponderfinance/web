import type { PrivyClientConfig } from '@privy-io/react-auth'
import { CURRENT_CHAIN } from '@/src/constants/chains'

export const privyConfig: PrivyClientConfig = {
  defaultChain: CURRENT_CHAIN,
  supportedChains: [CURRENT_CHAIN],
  loginMethods: ['wallet'],
  appearance: {
    theme: 'dark',
    walletList: ['okx_wallet', 'detected_wallets', 'metamask', 'wallet_connect'],
  },
}
