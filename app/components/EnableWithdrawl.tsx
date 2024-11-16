'use client'

import React, { useState } from 'react'
import { writeContract } from '@wagmi/core'
import { wagmiConfig } from '@/config'

// ABI for Safe's enableModule function
const safeAbi = [
  {
    inputs: [{ internalType: 'address', name: 'module', type: 'address' }],
    name: 'enableModule',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export const EnableWithdraw = () => {
  const [safeAddress, setSafeAddress] = useState('') // Address of the Safe to enable the module on
  const [transactionHash, setTransactionHash] = useState<null | `0x${string}`>(null) // For displaying transaction hash
  const [error, setError] = useState(null) // For displaying error messages

  const handleEnableModule = async () => {
    try {
      setError(null)

      const result = await writeContract(wagmiConfig, {
        abi: safeAbi,
        address: safeAddress as `0x${string}`,
        functionName: 'enableModule',
        args: ['0xb05A5272E884D057A18abefd8872D6Dad6251a8e'], // Diamond address
      })

      setTransactionHash(result) // Store the transaction hash if successful
    } catch (err: any) {
      console.error('Error enabling module:', err)
      setError(err.message) // Display error message
    }
  }

  return (
    <div>
      <h2>Enable Diamond as Module</h2>
      <label>
        Safe Address:
        <input
          type="text"
          value={safeAddress}
          onChange={(e) => setSafeAddress(e.target.value)} // Update Safe address
        />
      </label>
      <br />
      <button onClick={handleEnableModule}>Enable Diamond</button>
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
