import { createPublicClient, http } from 'viem'
import { bitkubChain } from '../src/constants/chains'

const KKUB_ADDRESS = '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5'
const UNWRAPPER_ADDRESS = '0xea1b8372b2ae06e905957f82969da8e8a3ba47c4' // From error logs
const YOUR_WALLET = '0xc1951eF408265A3b90d07B0BE030e63CCc7da6c6'

const allowanceAbi = [{
  name: 'allowance',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' }
  ],
  outputs: [{ name: '', type: 'uint256' }],
}] as const

const publicClient = createPublicClient({
  chain: bitkubChain,
  transport: http('https://dataseed2-rpc.bitkubchain.org'),
})

async function checkAllowance() {
  console.log('\n🔍 Checking KKUB Allowance...\n')

  const allowance = await publicClient.readContract({
    address: KKUB_ADDRESS,
    abi: allowanceAbi,
    functionName: 'allowance',
    args: [YOUR_WALLET, UNWRAPPER_ADDRESS],
  })

  console.log(`Wallet: ${YOUR_WALLET}`)
  console.log(`Unwrapper: ${UNWRAPPER_ADDRESS}`)
  console.log(`\nCurrent allowance: ${allowance.toString()}`)
  console.log(`In KKUB: ${Number(allowance) / 1e18}`)

  if (allowance > 0n) {
    console.log('\n✅ You already have an approval! No need to approve again.')
  } else {
    console.log('\n❌ No approval exists. You need to approve the unwrapper.')
  }
}

checkAllowance()
