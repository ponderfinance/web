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
    inputs: [{ internalType: 'uint8', name: 'foodType', type: 'uint8' }],
    name: 'feed',
    outputs: [],
    stateMutability: 'payable',
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

export const FeedPet = () => {
  const [foodType, setFoodType] = useState(0) // Default FoodType
  const [paymentAmount, setPaymentAmount] = useState('0.000333') // Default payment amount in ETH
  const [transactionHash, setTransactionHash] = useState<null | `0x${string}`>(null)
  const [error, setError] = useState(null)

  const handleFeedPet = async () => {
    try {
      setError(null)

      const paymentInWei = parseEther(paymentAmount) // Convert ETH to wei using viem

      const result = await writeContract(wagmiConfig, {
        ...config,
        abi: petFacetABI,
        address: '0xb05A5272E884D057A18abefd8872D6Dad6251a8e', // Diamond contract address
        functionName: 'feed',
        args: [foodType],
        value: paymentInWei, // Pass payment amount
      })

      setTransactionHash(result)
    } catch (err: any) {
      console.error('Error feeding pet:', err)
      setError(err.message)
    }
  }

  return (
    <div>
      <label>
        Food Type (Enum):
        <input
          type="number"
          value={foodType}
          onChange={(e) => setFoodType(Number(e.target.value))}
        />
      </label>
      <br />
      <label>
        Payment Amount (ETH):
        <input
          type="text"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
        />
      </label>
      <br />
      <button onClick={handleFeedPet}>Feed Pet</button>
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
