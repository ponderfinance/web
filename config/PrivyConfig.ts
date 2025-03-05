import type { PrivyClientConfig } from '@privy-io/react-auth'
import { CURRENT_CHAIN } from '@/src/app/constants/chains'

export const privyConfig: PrivyClientConfig = {
  defaultChain: CURRENT_CHAIN,
  supportedChains: [CURRENT_CHAIN],
  loginMethods: ['wallet', 'sms'],
  appearance: {
    theme: 'dark',
    walletList: ['detected_wallets', 'metamask', 'wallet_connect'],
  },
}
