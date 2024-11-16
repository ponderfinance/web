'use client'

import React, { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { readContract } from '@wagmi/core'
import { http, createConfig } from '@wagmi/core'
import { sepolia } from '@wagmi/core/chains'
import { wagmiConfig } from '@/config'

// ABI for PetFacet
const petFacetABI = [
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'getPet',
    outputs: [
      {
        components: [
          { internalType: 'uint8', name: 'petType', type: 'uint8' },
          { internalType: 'uint8', name: 'state', type: 'uint8' },
          { internalType: 'uint256', name: 'lastFed', type: 'uint256' },
          { internalType: 'uint256', name: 'happiness', type: 'uint256' },
          { internalType: 'bool', name: 'isPremium', type: 'bool' },
          { internalType: 'uint256', name: 'totalSavings', type: 'uint256' },
          { internalType: 'uint256', name: 'dailyTarget', type: 'uint256' },
          { internalType: 'uint256', name: 'lastMeal', type: 'uint256' },
          { internalType: 'address[]', name: 'owners', type: 'address[]' },
        ],
        internalType: 'struct PetFacet.PetInfo',
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
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

type PetInfo = {
  petType: number // Assuming uint8 maps to number in TypeScript
  state: number // Assuming uint8 maps to number in TypeScript
  lastFed: bigint // uint256 maps to bigint
  happiness: bigint // uint256 maps to bigint
  isPremium: boolean // bool maps to boolean
  totalSavings: bigint // uint256 maps to bigint
  dailyTarget: bigint // uint256 maps to bigint
  lastMeal: bigint // uint256 maps to bigint
  owners: string[] // address[] maps to string[]
}

export const ShowPet = () => {
  const { address, isConnected } = useAccount() // Retrieve the connected account
  const [pet, setPet] = useState<PetInfo | null>(null)
  const [error, setError] = useState(null)

  const handleFetchPet = async () => {
    try {
      if (!address) {
        return null
      }
      setError(null)

      const result: PetInfo = (await readContract(wagmiConfig, {
        ...config,
        abi: petFacetABI,
        address: '0x1DbB14EC649652F69a2B14B7314e9fA05813Cb5B',
        functionName: 'getPet',
        args: [address], // Use the connected wallet address
      })) as unknown as PetInfo

      setPet(result)
    } catch (err: any) {
      console.error('Error fetching pet:', err)
      setError(err.message)
    }
  }

  useEffect(() => {
    handleFetchPet()
  }, [address])

  return (
    <div>
      {pet?.lastFed === BigInt(0) || !pet ? (
        <div>Adopt a pet!</div>
      ) : (
        <div>Heres your pet</div>
      )}
    </div>
  )
}
