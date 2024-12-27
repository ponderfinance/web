import { View, Text, Button } from 'reshaped'
import { formatUnits } from 'viem'
import type { TokenInputProps } from '../types/swap'
import React from "react";

export function TokenInput({
  label,
  value,
  onChange,
  tokenInfo,
  balance,
  isReadOnly = false,
  onMaxClick,
  onTokenSelect,
  isProcessing,
  placeholder = '0.0',
  className,
}: TokenInputProps) {
  return (
    <View gap={8} className={className}>
      {/* Header Section */}
      <View direction="row" justify="space-between" align="center">
        <Text>{label}</Text>
        {balance !== undefined && tokenInfo && (
          <View direction="row" gap={2} align="center">
            <Text variant="body-2" color="neutral">
              Balance: {formatUnits(balance, tokenInfo.decimals || 18)} {tokenInfo.symbol}
            </Text>
            {balance > BigInt(0) && onMaxClick && !isReadOnly && (
              <Button
                variant="ghost"
                size="small"
                onClick={onMaxClick}
                disabled={isProcessing}
              >
                MAX
              </Button>
            )}
          </View>
        )}
      </View>

      {/* Input Section */}
      <View
        direction="row"
        gap={8}
        className="rounded-lg border border-neutral-200 bg-white p-4 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={isReadOnly}
          disabled={isProcessing}
          className="w-full bg-transparent text-lg outline-none placeholder:text-neutral-400"
        />
        <Button
          variant="outline"
          onClick={onTokenSelect}
          disabled={isProcessing}
          className="min-w-[120px]"
        >
          {tokenInfo?.symbol || 'Select Token'}
        </Button>
      </View>
    </View>
  )
}

// Error boundary for TokenInput
export class TokenInputErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('TokenInput Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <View gap={4} padding={4} className="rounded-lg border border-red-200 bg-red-50">
          <Text color="critical">Failed to load token input.</Text>
          <Button
            variant="outline"
            size="small"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </Button>
        </View>
      )
    }

    return this.props.children
  }
}

// Wrap TokenInput with error boundary
export default function TokenInputWithErrorBoundary(props: TokenInputProps) {
  return (
    <TokenInputErrorBoundary>
      <TokenInput {...props} />
    </TokenInputErrorBoundary>
  )
}
