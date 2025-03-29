import { type Address } from 'viem'

export interface Chain {
  id: number
  name: string
  icon: string
  rpcUrl: string
}

export interface Token {
  address: Address
  symbol: string
  decimals: number
  icon: string
}

export interface BridgeParams {
  token: Address
  amount: bigint
  destChainID: bigint
  recipient: Address
  destTokenType: number
}

export interface BridgeInfo {
  enabled: boolean
  token: string
  chainID: bigint
  allowedDestTokenTypes: number
  feeReceiver: string
  fee: bigint
  feeType: number
  strategy: number
  receiver: string
} 