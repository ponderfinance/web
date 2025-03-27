import { useState } from 'react'
import { Text, View, Button, Modal, useToggle } from 'reshaped'
import FarmList from './FarmList'
import StakingInterface from '../../../components/StakingInterface'
import BoostInterface from '../../../components/BoostInterface'
import { Address } from 'viem'
import CreateFarm from '@/src/modules/farm/components/CreateFarm'


export default function KoiPond() {
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
        <Text variant="title-5" weight="regular" align="center">
          KOI Pond
        </Text>
        <Text>
          Provide liquidity and stake LP tokens to receive KOI. Lock KOI to amplify your
          distribution rate.
        </Text>
        <FarmList />
        {/*<View position="absolute" insetTop={4} insetEnd={4}>*/}
        {/*  <Button onClick={activate}>Create Farm</Button>*/}
        {/*</View>*/}

        {/*<Modal active={active} onClose={deactivate}>*/}
        {/*  <CreateFarm />*/}
        {/*</Modal>*/}
      </View>
    </View>
  )
}
