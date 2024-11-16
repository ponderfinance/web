'use client'

import React, { useState, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { readContract, writeContract } from '@wagmi/core'
import { http, createConfig } from '@wagmi/core'
import { sepolia } from '@wagmi/core/chains'
import { parseEther } from 'viem'
import { wagmiConfig } from '@/config'

// PetInfo Type
type PetInfo = {
  petType: number
  state: number
  lastFed: bigint
  happiness: bigint
  totalSavings: bigint
  dailyTarget: bigint
  lastMeal: number
  owners: string[]
}

// ABI Definitions
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
          { internalType: 'uint256', name: 'totalSavings', type: 'uint256' },
          { internalType: 'uint256', name: 'dailyTarget', type: 'uint256' },
          { internalType: 'uint8', name: 'lastMeal', type: 'uint8' },
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
  {
    inputs: [{ internalType: 'uint8', name: 'foodType', type: 'uint8' }],
    name: 'feed',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
]

// Food Items Data
const foodItems = [
  { name: 'Banana', price: 0.000333, type: 0, image: '/pets/banana.png' },
  { name: 'Egg', price: 0.000666, type: 1, image: '/pets/egg.png' },
  { name: 'Toast', price: 0.000999, type: 2, image: '/pets/toast.png' },
  { name: 'Donut', price: 0.001665, type: 3, image: '/pets/donut.png' },
  { name: 'Onigiri', price: 0.002331, type: 4, image: '/pets/onigiri.png' },
  { name: 'Salmon', price: 0.00333, type: 5, image: '/pets/salmon.png' },
  { name: 'Steak', price: 0.00666, type: 6, image: '/pets/steak.png' },
]

const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(
      `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
    ),
  },
})

export const Snacks = () => {
  const { address, isConnected } = useAccount()
  const [hasPet, setHasPet] = useState(false)
  const [selectedFood, setSelectedFood] = useState<number | null>(null)
  const [transactionHash, setTransactionHash] = useState<null | `0x${string}`>(null)
  const [error, setError] = useState(null)

  // Watch for transaction completion
  const { isLoading: isWaitingForTx, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({
      hash: transactionHash as `0x${string}`,
    })

  useEffect(() => {
    // Reset UI state after transaction settles
    if (txSuccess) {
      setSelectedFood(null)
      setTransactionHash(null)
    }
  }, [txSuccess])

  // Fetch pet information to check if user has a pet
  useEffect(() => {
    const fetchPet = async () => {
      try {
        if (!address) return

        // Read contract result and explicitly type it as PetInfo
        const result = (await readContract(wagmiConfig, {
          ...config,
          abi: petFacetABI,
          address: '0x1DbB14EC649652F69a2B14B7314e9fA05813Cb5B',
          functionName: 'getPet',
          args: [address],
        })) as PetInfo

        // Check if the pet exists
        setHasPet(result && result.lastFed !== BigInt(0))
      } catch (err) {
        console.error('Error fetching pet:', err)
        setHasPet(false)
      }
    }

    if (isConnected) fetchPet()
  }, [address, isConnected])

  const handleFeed = async (foodType: number, price: number) => {
    try {
      setError(null)
      setSelectedFood(null)

      const paymentInWei = parseEther(price.toString())

      const result = await writeContract(wagmiConfig, {
        ...config,
        abi: petFacetABI,
        address: '0x1DbB14EC649652F69a2B14B7314e9fA05813Cb5B',
        functionName: 'feed',
        args: [foodType],
        value: paymentInWei,
      })

      setTransactionHash(result)
    } catch (err: any) {
      console.error('Error feeding pet:', err)
      setError(err.message)
    }
  }

  if (!hasPet) {
    return <p>You need a pet to view snacks.</p>
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1
        className="text-3xl text-center mb-8"
        style={{ fontFamily: 'var(--font-silkscreen)' }}
      >
        SNACKS
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {foodItems.map((item) => (
          <div key={item.type} className="flex flex-col items-center">
            <button
              onClick={() => setSelectedFood(item.type)}
              className={`w-48 h-48 rounded-full flex items-center justify-center transition-all
                ${
                  selectedFood === item.type
                    ? 'border-2 border-black'
                    : 'border-2 border-gray-100 hover:border-black'
                }
                bg-white p-4`}
            >
              <div className="flex items-center justify-center w-full h-full">
                <img
                  src={item.image}
                  alt={item.name}
                  className="max-w-[80%] max-h-[80%] object-contain"
                />
              </div>
            </button>
            <div className="mt-2 text-center">
              <p className="text-lg" style={{ fontFamily: 'var(--font-silkscreen)' }}>
                {item.name}
              </p>
              <p className="text-sm text-gray-600 mb-2">{item.price} ETH</p>
              {selectedFood === item.type && (
                <button
                  onClick={() => handleFeed(item.type, item.price)}
                  disabled={isWaitingForTx}
                  className={`bg-black text-white px-6 py-2 rounded-full transition-all transform hover:scale-105 ${
                    isWaitingForTx ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  style={{ fontFamily: 'var(--font-silkscreen)' }}
                >
                  {isWaitingForTx ? 'FEEDING...' : 'FEED'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
