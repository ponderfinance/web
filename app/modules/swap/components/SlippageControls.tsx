import { useState } from 'react'
import { View, Text, Button } from 'reshaped'
import type { SlippageControlsProps } from '../types/swap'

const PREDEFINED_SLIPPAGES = [0.1, 0.5, 1.0]
const MAX_SLIPPAGE = 50 // 50%
const DANGER_SLIPPAGE = 5 // 5%
const WARNING_SLIPPAGE = 1 // 1%

export function SlippageControls({
  slippage,
  setSlippage,
  isProcessing,
  className,
}: SlippageControlsProps) {
  const [isCustom, setIsCustom] = useState(false)
  const [customValue, setCustomValue] = useState('')

  const handleCustomValueChange = (value: string) => {
    // Allow only numbers and decimals
    if (!/^\d*\.?\d*$/.test(value)) return

    // Prevent multiple decimal points
    if ((value.match(/\./g) || []).length > 1) return

    // Limit to 1 decimal place
    const parts = value.split('.')
    if (parts[1] && parts[1].length > 1) return

    setCustomValue(value)
    const numValue = parseFloat(value)

    if (numValue && !isNaN(numValue) && numValue <= MAX_SLIPPAGE) {
      setSlippage(numValue)
    }
  }

  const getSlippageColor = (value: number) => {
    if (value >= DANGER_SLIPPAGE) return 'critical'
    if (value >= WARNING_SLIPPAGE) return 'warning'
    return 'neutral'
  }

  const handlePresetClick = (value: number) => {
    setIsCustom(false)
    setCustomValue('')
    setSlippage(value)
  }

  return (
    <View gap={4} className={className}>
      <View direction="row" justify="space-between" align="center">
        <Text variant="body-2">Slippage Tolerance</Text>
        <Text
          variant="body-2"
          color={getSlippageColor(slippage)}
          weight={slippage >= WARNING_SLIPPAGE ? 'medium' : 'regular'}
        >
          {slippage}%
        </Text>
      </View>

      <View direction="row" gap={2} justify="center">
        {/* Preset Values */}
        {PREDEFINED_SLIPPAGES.map((value) => (
          <Button
            key={value}
            variant={!isCustom && slippage === value ? 'outline' : 'ghost'}
            size="small"
            onClick={() => handlePresetClick(value)}
            disabled={isProcessing}
          >
            {value}%
          </Button>
        ))}

        {/* Custom Input */}
        <View direction="row" gap={1}>
          <Button
            variant={isCustom ? 'outline' : 'ghost'}
            size="small"
            onClick={() => setIsCustom(true)}
            disabled={isProcessing}
          >
            {isCustom ? (
              <input
                type="text"
                value={customValue}
                onChange={(e) => handleCustomValueChange(e.target.value)}
                className="w-12 bg-transparent text-center outline-none"
                placeholder="0.0"
                autoFocus
              />
            ) : (
              'Custom'
            )}
          </Button>
          {isCustom && <Text variant="body-2">%</Text>}
        </View>
      </View>

      {/* Warnings */}
      {slippage >= DANGER_SLIPPAGE && (
        <Text variant="body-2" color="critical" align="center">
          Warning: High slippage increases risk of unfavorable trades
        </Text>
      )}
      {slippage >= WARNING_SLIPPAGE && slippage < DANGER_SLIPPAGE && (
        <Text variant="body-2" color="warning" align="center">
          Your transaction may be frontrun
        </Text>
      )}
      {slippage < 0.1 && (
        <Text variant="body-2" color="warning" align="center">
          Your transaction may fail
        </Text>
      )}
    </View>
  )
}

export default SlippageControls
