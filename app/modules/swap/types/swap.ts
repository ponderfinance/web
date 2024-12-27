import { type Address } from 'viem'
import { type SwapResult } from '@ponderfinance/sdk'

export interface TokenInfo {
  symbol?: string
  decimals?: number
}

export interface TokenSelectorProps {
  token?: Address
  tokenInfo?: TokenInfo
  onSelect: () => void
  isProcessing: boolean
}

export interface TokenInputProps {
  label: string
  value: string
  onChange?: (value: string) => void
  tokenInfo?: TokenInfo
  balance?: bigint
  isReadOnly?: boolean
  onMaxClick?: () => void
  onTokenSelect: () => void
  isProcessing: boolean
  placeholder?: string
  className?: string
}

export interface SwapDetailsProps {
  route: any // Replace with proper route type from SDK
  minimumReceived?: { formatted: string }
  tokenOutInfo?: TokenInfo
  tokenInInfo?: TokenInfo
  gasEstimate?: { estimateInKUB: string }
}

export interface SlippageControlsProps {
  slippage: number
  setSlippage: (value: number) => void
  isProcessing: boolean
  className?: string
}

export interface RouteDisplayProps {
  route: any // Replace with proper route type from SDK
  tokenInInfo?: TokenInfo
  tokenOutInfo?: TokenInfo
  className?: string
}

export interface SwapInterfaceProps {
  defaultTokenIn?: Address
  defaultTokenOut?: Address
  className?: string
}

// Base swap params shared across all swap types
export interface BaseSwapParams {
  path: Address[]
  to: Address
  deadline: bigint
}

export interface SwapExactTokensForTokensParams extends BaseSwapParams {
  amountIn: bigint
  amountOutMin: bigint
}

export interface SwapTokensForExactTokensParams extends BaseSwapParams {
  amountOut: bigint
  amountInMax: bigint
}

export interface SwapExactETHForTokensParams extends BaseSwapParams {
  amountOutMin: bigint
}

export interface SwapTokensForExactETHParams extends BaseSwapParams {
  amountOut: bigint
  amountInMax: bigint
}

export interface SwapExactTokensForETHParams extends BaseSwapParams {
  amountIn: bigint
  amountOutMin: bigint
}

export interface SwapETHForExactTokensParams extends BaseSwapParams {
  amountOut: bigint
  value: bigint
}

export type SwapParams =
  | {
      type: 'exactETHForTokens'
      params: SwapExactETHForTokensParams
      value: bigint
    }
  | {
      type: 'tokensForExactETH'
      params: SwapTokensForExactETHParams
    }
  | {
      type: 'exactTokensForETH'
      params: SwapExactTokensForETHParams
    }
  | {
      type: 'ETHForExactTokens'
      params: SwapETHForExactTokensParams
      value: bigint
    }
  | {
      type: 'exactTokensForTokens'
      params: SwapExactTokensForTokensParams
    }

export interface SwapState {
  tokenIn?: Address
  tokenOut?: Address
  amountIn: string
  slippage: number
  error: string | null
  isProcessing: boolean
  txHash?: string
  approvalsPending: Set<Address>
}
