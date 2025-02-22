import { useState } from 'react'
import { Text, View, Button, Modal, useToggle } from 'reshaped'
import FarmList from './FarmList'
import StakingInterface from '../../../components/StakingInterface'
import BoostInterface from '../../../components/BoostInterface'
import { Address } from 'viem'
import CreateFarm from '@/src/app/modules/farm/components/CreateFarm'

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

  const { active, activate, deactivate } = useToggle(false)

  return (
    <View gap={6} maxWidth={{ s: '100%', m: '1086px' }} width="100%">
      <View
        direction="column"
        gap={4}
        borderColor="neutral-faded"
        padding={8}
        paddingInline={8}
        borderRadius="large"
      >
        <Text variant="title-5" weight="regular">
          KOI Emissions
        </Text>
        <Text>
          Provide liquidity and stake LP tokens to receive KOI. Lock KOI to amplify your
          distribution rate.
        </Text>
        <FarmList />
        <View position="absolute" insetTop={4} insetEnd={4}>
          <Button onClick={activate}>Create Farm</Button>
        </View>

        <Modal active={active} onClose={deactivate}>
          <CreateFarm />
        </Modal>
      </View>

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
