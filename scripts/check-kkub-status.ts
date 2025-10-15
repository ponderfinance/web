import { createPublicClient, http } from 'viem'
import { bitkubChain } from '../src/constants/chains'

const KKUB_ADDRESS = '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5'
const YOUR_WALLET = '0xc1951eF408265A3b90d07B0BE030e63CCc7da6c6' // From error logs

const kkubAbi = [
  {
    name: 'blacklist',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'addr', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'paused',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'kycsLevel',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

const publicClient = createPublicClient({
  chain: bitkubChain,
  transport: http('https://dataseed2-rpc.bitkubchain.org'),
})

async function checkKKUBStatus() {
  console.log('\n🔍 Checking KKUB Contract Status...\n')
  console.log(`KKUB Address: ${KKUB_ADDRESS}`)
  console.log(`Your Wallet: ${YOUR_WALLET}\n`)

  try {
    // Check if wallet is blacklisted
    const isBlacklisted = await publicClient.readContract({
      address: KKUB_ADDRESS,
      abi: kkubAbi,
      functionName: 'blacklist',
      args: [YOUR_WALLET],
    })

    console.log(`❌ Wallet Blacklisted: ${isBlacklisted}`)

    // Check if contract is paused
    const isPaused = await publicClient.readContract({
      address: KKUB_ADDRESS,
      abi: kkubAbi,
      functionName: 'paused',
      args: [],
    })

    console.log(`⏸️  Contract Paused: ${isPaused}`)

    // Check required KYC level
    const requiredKycLevel = await publicClient.readContract({
      address: KKUB_ADDRESS,
      abi: kkubAbi,
      functionName: 'kycsLevel',
      args: [],
    })

    console.log(`🎫 Required KYC Level: ${requiredKycLevel}`)

    console.log('\n' + '='.repeat(60))
    if (isBlacklisted) {
      console.log('⚠️  YOUR WALLET IS BLACKLISTED!')
      console.log('You cannot approve or transfer KKUB.')
      console.log('Contact KKUB contract owner to get un-blacklisted.')
    } else if (isPaused) {
      console.log('⚠️  KKUB CONTRACT IS PAUSED!')
      console.log('Approvals and transfers are disabled.')
      console.log('Wait for contract owner to unpause.')
    } else {
      console.log('✅ No obvious issues detected.')
      console.log('The approval might be failing due to KYC requirements.')
    }
    console.log('='.repeat(60) + '\n')

  } catch (error) {
    console.error('Error checking KKUB status:', error)
  }
}

checkKKUBStatus()