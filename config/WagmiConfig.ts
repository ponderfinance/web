import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { bitkubChain, bitkubTestnetChain } from "@/src/constants/chains";

export const wagmiConfig = createConfig({
  chains: [mainnet, bitkubChain, bitkubTestnetChain],
  transports: {
    [mainnet.id]: http(),
    [bitkubChain.id]: http(),
    [bitkubTestnetChain.id]: http(),
  },
})
