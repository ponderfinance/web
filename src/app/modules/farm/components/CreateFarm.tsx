import { useState } from 'react'
import { usePonderSDK } from '@ponderfinance/sdk'
import {getAddress} from "viem";

const MASTERCHEF_ABI = [
  {
    inputs: [
      { name: '_allocPoint', type: 'uint256' },
      { name: '_lpToken', type: 'address' },
      { name: '_depositFeeBP', type: 'uint16' },
      { name: '_boostMultiplier', type: 'uint16' },
    ],
    name: 'add',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export default function CreateFarm() {
  const sdk = usePonderSDK()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [values, setValues] = useState({
    lpToken: '',
    allocPoint: '100',
    depositFeeBP: '0',
    boostMultiplier: '10000',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      if (!sdk.walletClient?.account) {
        throw new Error('Wallet not connected')
      }

      const { request } = await sdk.publicClient.simulateContract({
        address: sdk.masterChef.address,
        abi: MASTERCHEF_ABI,
        functionName: 'add',
        args: [
          BigInt(values.allocPoint),
          getAddress(values.lpToken),
          Number(values.depositFeeBP),
          Number(values.boostMultiplier),
        ],
        account: sdk.walletClient.account.address,
      })

      const tx = await sdk.walletClient.writeContract(request)
      await sdk.publicClient.waitForTransactionReceipt({ hash: tx })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  return (
    <div className="max-w-md mx-auto p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Create New Farm</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">LP Token Address</label>
          <input
            type="text"
            name="lpToken"
            value={values.lpToken}
            onChange={handleChange}
            placeholder="0x..."
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Allocation Points</label>
          <input
            type="number"
            name="allocPoint"
            value={values.allocPoint}
            onChange={handleChange}
            placeholder="1000"
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1">Deposit Fee (BP)</label>
          <input
            type="number"
            name="depositFeeBP"
            value={values.depositFeeBP}
            onChange={handleChange}
            placeholder="0"
            className="w-full p-2 border rounded"
            required
          />
          <small className="text-gray-500">1000 = 10%</small>
        </div>

        <div>
          <label className="block mb-1">Boost Multiplier</label>
          <input
            type="number"
            name="boostMultiplier"
            value={values.boostMultiplier}
            onChange={handleChange}
            placeholder="10000"
            className="w-full p-2 border rounded"
            required
          />
          <small className="text-gray-500">10000 = 1x, 20000 = 2x</small>
        </div>

        {error && <div className="text-red-500">{error}</div>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isSubmitting ? 'Creating...' : 'Create Farm'}
        </button>
      </form>
    </div>
  )
}
