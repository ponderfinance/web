import { createConfig, http } from 'wagmi'
import {bitkubChain, bitkubTestnetChain} from "@/src/app/constants/chains";

export const wagmiConfig = createConfig({
  chains: [bitkubChain, bitkubTestnetChain],
  transports: {
    [bitkubChain.id]: http(),
    [bitkubTestnetChain.id]: http(),
  },
})
