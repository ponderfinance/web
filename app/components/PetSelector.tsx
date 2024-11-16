import React, { useState, useEffect } from 'react'
import { useAccount, useWaitForTransactionReceipt } from 'wagmi'
import { writeContract, readContract } from '@wagmi/core'
import { parseEther } from 'viem'
import { wagmiConfig } from '@/config'
import { usePrivy } from '@privy-io/react-auth'

type PetInfo = {
  petType: number
  state: number
  lastFed: bigint
  happiness: bigint
  isPremium: boolean
  totalSavings: bigint
  dailyTarget: bigint
  lastMeal: bigint
  owners: string[]
}

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

const DEFAULT_DAILY_TARGET = '0.000333'

const pets = [
  {
    id: 'bobo',
    name: 'BOBO',
    description: 'A SWEET CAT',
    type: 1,
    image: '/pets/bobo-content.png',
  },
  {
    id: 'didi',
    name: 'DIDI',
    description: 'A LOYAL DOG',
    type: 0,
    image: '/pets/didi-content.png',
  },
  {
    id: 'moo',
    name: 'MOO',
    description: 'A BABY HIPPO',
    type: 2,
    image: '/pets/moo-content.png',
  },
]

const getPetStateImage = (petType: number, state: number) => {
  const petId = ['didi', 'bobo', 'moo'][petType]
  const stateMap = ['stuffed', 'full', 'content', 'hangry', 'starving'][state]
  return `/pets/${petId}-${stateMap}.png`
}

const PetSelector = () => {
  const { authenticated, login } = usePrivy()
  const { address } = useAccount()
  const [pet, setPet] = useState<PetInfo | null>(null)
  const [hoveredPet, setHoveredPet] = useState(pets[0])
  const [selectedPet, setSelectedPet] = useState<(typeof pets)[0] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transactionHash, setTransactionHash] = useState<`0x${string}` | null>(null)

  const { isLoading: isWaitingForTx, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({
      hash: transactionHash!,
    })

  const handleFetchPet = async () => {
    try {
      if (!address) return
      setError(null)

      const result = (await readContract(wagmiConfig, {
        abi: petFacetABI,
        address: '0x1DbB14EC649652F69a2B14B7314e9fA05813Cb5B',
        functionName: 'getPet',
        args: [address],
      })) as unknown as PetInfo

      setPet(result)
    } catch (err: any) {
      console.error('Error fetching pet:', err)
      setError(err.message)
    }
  }

  useEffect(() => {
    if (txSuccess) {
      handleFetchPet()
    }
  }, [txSuccess])

  const handleAdoptPet = async () => {
    if (!selectedPet) return

    try {
      setError(null)
      const dailyTargetInWei = parseEther(DEFAULT_DAILY_TARGET)

      const result = await writeContract(wagmiConfig, {
        abi: petFacetABI,
        address: '0x1DbB14EC649652F69a2B14B7314e9fA05813Cb5B',
        functionName: 'initializePet',
        args: [selectedPet.type, dailyTargetInWei],
      })

      setTransactionHash(result)
    } catch (err: any) {
      console.error('Error adopting pet:', err)
      setError(err.message)
    }
  }

  useEffect(() => {
    handleFetchPet()
  }, [address])

  if (pet && pet.lastFed !== BigInt(0)) {
    // Calculate percentage towards 32 ETH
    const totalEth = Number(pet.totalSavings) / 1e18 // Convert from Wei to ETH
    const targetEth = 32
    const percentageToTarget = (totalEth / targetEth) * 100

    return (
      <div className="max-w-6xl mx-auto p-4 text-center">
        <h2
          className="text-2xl md:text-3xl mb-8"
          style={{ fontFamily: 'var(--font-silkscreen)' }}
        >
          YOUR PET
        </h2>
        <div className="flex justify-center">
          <div className="w-64 h-64 rounded-full border-2 border-black p-4 overflow-hidden">
            <img
              src={getPetStateImage(pet.petType, pet.state)}
              alt="Your Pet"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xl" style={{ fontFamily: 'var(--font-silkscreen)' }}>
              {['DIDI', 'BOBO', 'MOO'][pet.petType]}
            </p>
            <p className="text-lg">
              Status: {['STUFFED', 'FULL', 'CONTENT', 'HUNGRY', 'STARVING'][pet.state]}
            </p>
          </div>

          {/* Savings Progress */}
          <div className="mt-6 space-y-2">
            <p className="text-lg font-medium">
              Total Savings: {totalEth.toFixed(4)} ETH
            </p>
            <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-black h-2.5 rounded-full transition-all"
                style={{ width: `${Math.min(percentageToTarget, 100)}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600">
              {percentageToTarget.toFixed(2)}% progress to validator (32 ETH)
            </p>
          </div>

          {/* Owners List */}
          <div className="mt-6">
            <p className="text-lg font-medium mb-2">Owners ({pet.owners.length}):</p>
            <div className="flex flex-col items-center gap-2">
              {pet.owners.map((owner, index) => (
                <a
                  key={index}
                  href={`https://sepolia.etherscan.io/address/${owner}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline break-all"
                >
                  {owner}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2
            className="text-2xl md:text-3xl"
            style={{ fontFamily: 'var(--font-silkscreen)' }}
          >
            CHOOSE A PET
          </h2>
          <div className="space-y-1">
            <p className="text-md font-medium">
              SNACKS SAVINGS POOL: EVERY ETH DEPOSIT COUNTS TOWARD LAUNCHING A VALIDATOR
            </p>
            <p className="text-md font-medium">
              DECENTRALIZATION: HELP ETHEREUM BY MAKING THE NETWORK MORE ROBUST AND
              DISTRIBUTED
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {pets.map((pet) => (
            <div
              key={pet.id}
              className="relative flex flex-col items-center"
              onMouseEnter={() => setHoveredPet(pet)}
              onClick={() => setSelectedPet(pet)}
            >
              <div
                className={`w-48 h-48 overflow-hidden rounded-full border-2 border-black p-4 cursor-pointer transition-colors ${
                  selectedPet?.id === pet.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <img
                  src={pet.image}
                  alt={pet.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <p
                className="mt-2 text-lg"
                style={{ fontFamily: 'var(--font-silkscreen)' }}
              >
                {pet.name}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center space-y-4">
          <p className="text-sm font-medium">
            CHOOSE WISELY- YOU WILL NOT BE ABLE TO CHANGE YOUR PET ONCE YOU START
            SNACKING*.
          </p>
          <p
            className="text-xl font-medium"
            style={{ fontFamily: 'var(--font-silkscreen)' }}
          >
            {hoveredPet.name}: {hoveredPet.description}
          </p>

          {selectedPet && (
            <button
              onClick={authenticated ? handleAdoptPet : login}
              disabled={isWaitingForTx}
              className={`bg-black text-white px-8 py-2 rounded-full transition-all transform hover:scale-105 ${
                isWaitingForTx ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              style={{ fontFamily: 'var(--font-silkscreen)' }}
            >
              {isWaitingForTx ? 'ADOPTING...' : `ADOPT ${selectedPet.name}`}
            </button>
          )}

          {error && <p className="text-red-500 mt-4">{error}</p>}

          {transactionHash && (
            <p className="mt-4">
              {txSuccess ? 'Adoption successful!' : 'Transaction sent!'}{' '}
              <a
                href={`https://sepolia.etherscan.io/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                View on Etherscan
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default PetSelector
