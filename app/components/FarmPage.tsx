import { useState } from 'react'
import { Text, View, Button } from 'reshaped'
import FarmList from './FarmList'
import StakingInterface from './StakingInterface'
import BoostInterface from './BoostInterface'
import { Address } from 'viem'

interface ManageFarmModalProps {
  pid: number
  lpToken: Address
  token0Symbol: string
  token1Symbol: string
  depositFee: number
  boostMultiplier: number
  onClose: () => void
}

function ManageFarmModal({
  pid,
  lpToken,
  token0Symbol,
  token1Symbol,
  depositFee,
  boostMultiplier,
  onClose,
}: ManageFarmModalProps) {
  return (
    <View gap={16} padding={16} className="rounded-lg max-w-lg w-full">
      <View direction="row" align="center">
        <Text variant="title-3">Manage Farm Position</Text>
        <Button variant="ghost" onClick={onClose}>
          ✕
        </Button>
      </View>

      <StakingInterface
        pid={pid}
        lpToken={lpToken}
        token0Symbol={token0Symbol}
        token1Symbol={token1Symbol}
        depositFee={depositFee}
      />

      <BoostInterface pid={pid} boostMultiplier={boostMultiplier} />
    </View>
  )
}

export default function FarmingPage() {
  const [selectedFarm, setSelectedFarm] = useState<{
    pid: number
    lpToken: Address
    token0Symbol: string
    token1Symbol: string
    depositFee: number
    boostMultiplier: number
  } | null>(null)

  const handleManageFarm = (farm: {
    pid: number
    lpToken: Address
    token0Symbol: string
    token1Symbol: string
    depositFee: number
    boostMultiplier: number
  }) => {
    setSelectedFarm(farm)
  }

  return (
    <View gap={24} className="max-w-4xl mx-auto p-4">
      <View gap={8}>
        <Text variant="body-1">Yield Farming</Text>
        <Text>
          Stake your LP tokens to earn PONDER rewards. Boost your earnings by staking
          PONDER tokens.
        </Text>
      </View>

      <FarmList />

      {/* Modal overlay */}
      {selectedFarm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <ManageFarmModal
            pid={selectedFarm.pid}
            lpToken={selectedFarm.lpToken}
            token0Symbol={selectedFarm.token0Symbol}
            token1Symbol={selectedFarm.token1Symbol}
            depositFee={selectedFarm.depositFee}
            boostMultiplier={selectedFarm.boostMultiplier}
            onClose={() => setSelectedFarm(null)}
          />
        </div>
      )}
    </View>
  )
}
