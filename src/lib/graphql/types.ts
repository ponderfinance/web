import { PrismaClient } from '@prisma/client'
import { Loaders } from '../dataloader'
import { PublicClient } from 'viem'

export interface Context {
  prisma: PrismaClient
  req?: Request
  loaders: Loaders
  publicClient: PublicClient
}

export interface Empty {}

export interface PrismaToken {
  id: string
  address: string
  name?: string | null
  symbol?: string | null
  decimals?: number | null
  imageUri?: string | null
  stablePair?: string | null
  priceUsd?: string | null
  priceChange24h?: number | null
  volumeUsd24h?: string | null
  lastPriceUpdate?: Date | null
  createdAt: Date
  updatedAt: Date
  pairsAsToken0?: PrismaPair[]
  pairsAsToken1?: PrismaPair[]
  supplies?: PrismaTokenSupply[]
}

export interface PrismaPair {
  id: string
  address: string
  token0Id: string
  token1Id: string
  reserve0: string
  reserve1: string
  totalSupply: string
  feesPending0: string
  feesPending1: string
  feesCollected0: string
  feesCollected1: string
  createdAt: Date
  updatedAt: Date
  lastBlockUpdate: number
  token0: PrismaToken
  token1: PrismaToken
}

export interface PrismaTokenSupply {
  id: string
  tokenId: string
  amount: string
  isMaxSupply: boolean
  timestamp: number
  createdAt: Date
  token: PrismaToken
}

export interface PrismaLaunch {
  id: string
  launchId: number
  tokenAddress: string
  creatorAddress: string
  imageUri: string
  kubRaised: string
  ponderRaised: string
  status: string
  kubPairAddress: string | null
  ponderPairAddress: string | null
  hasDualPools: boolean | null
  ponderPoolSkipped: boolean | null
  skippedPonderAmount: string | null
  skippedPonderValue: string | null
  kubLiquidity: string | null
  ponderLiquidity: string | null
  ponderBurned: string | null
  lpWithdrawn: boolean | null
  lpWithdrawnAt: Date | null
  completedAt: Date | null
  cancelledAt: Date | null
  createdAt: Date
  updatedAt: Date
}
