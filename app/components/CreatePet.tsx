'use client'

import React, { useState } from 'react'
import { writeContract } from '@wagmi/core'
import { http, createConfig } from '@wagmi/core'
import { sepolia } from '@wagmi/core/chains'
import { parseEther } from 'viem'
import { wagmiConfig } from '@/config'

// Manual ABI for PetFacet
const petFacetABI = [
  {
    inputs: [
      { internalType: 'uint8', name: 'petType', type: 'uint8' },
      { internalType: 'uint256', name: 'dailyTarget', type: 'uint256' },
    ],
    name: 'initializePet',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(
      `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
    ),
  },
})

export const CreatePet = () => {
  const [petType, setPetType] = useState(1)
  const [dailyTarget, setDailyTarget] = useState('0.000333') // Default daily target in ETH
  const [transactionHash, setTransactionHash] = useState<null | `0x${string}`>(null)
  const [error, setError] = useState(null)

  const handleCreatePet = async () => {
    try {
      setError(null)

      const dailyTargetInWei = parseEther(dailyTarget)

      const result = await writeContract(wagmiConfig, {
        ...config,
        abi: petFacetABI,
        address: '0xb05A5272E884D057A18abefd8872D6Dad6251a8e',
        functionName: 'initializePet',
        args: [petType, dailyTargetInWei],
      })

      setTransactionHash(result)
    } catch (err: any) {
      console.error('Error creating pet:', err)
      setError(err.message)
    }
  }

  return (
    <div>
      <label>
        Pet Type (Enum):
        <input
          type="number"
          value={petType}
          onChange={(e) => setPetType(Number(e.target.value))}
        />
      </label>
      <br />
      <label>
        Daily Target (ETH):
        <input
          type="text"
          value={dailyTarget}
          onChange={(e) => setDailyTarget(e.target.value)}
        />
      </label>
      <br />
      <button onClick={handleCreatePet}>Create Pet</button>
      {transactionHash && (
        <p>
          Transaction sent!{' '}
          <a
            href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Etherscan
          </a>
        </p>
      )}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  )
}
