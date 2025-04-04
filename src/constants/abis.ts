export const ORACLE_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'pair',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'tokenIn',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'amountIn',
        type: 'uint256'
      },
      {
        internalType: 'uint32',
        name: 'period',
        type: 'uint32'
      }
    ],
    name: 'consult',
    outputs: [
      {
        internalType: 'uint256',
        name: 'amountOut',
        type: 'uint256'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'pair',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'tokenIn',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'amountIn',
        type: 'uint256'
      }
    ],
    name: 'getCurrentPrice',
    outputs: [{ name: 'amountOut', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'pair', type: 'address' }],
    name: 'isPairInitialized',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'pair', type: 'address' }],
    name: 'update',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'pair', type: 'address' }],
    name: 'initializePair',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'pair', type: 'address' }],
    name: 'lastUpdateTime',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'pair', type: 'address' }],
    name: 'observationLength',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'pair', type: 'address' },
      { name: 'index', type: 'uint256' }
    ],
    name: 'observations',
    outputs: [
      { name: 'timestamp', type: 'uint32' },
      { name: 'price0Cumulative', type: 'uint224' },
      { name: 'price1Cumulative', type: 'uint224' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'factory',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'baseToken',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'pair', type: 'address' },
      { name: 'price0Cumulative', type: 'uint256' },
      { name: 'price1Cumulative', type: 'uint256' },
      { name: 'blockTimestamp', type: 'uint32' }
    ],
    name: 'OracleUpdated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'pair', type: 'address' },
      { name: 'timestamp', type: 'uint32' }
    ],
    name: 'PairInitialized',
    type: 'event'
  },
  {
    inputs: [],
    name: 'InvalidPair',
    type: 'error'
  },
  {
    inputs: [],
    name: 'InvalidToken',
    type: 'error'
  },
  {
    inputs: [],
    name: 'UpdateTooFrequent',
    type: 'error'
  },
  {
    inputs: [],
    name: 'StalePrice',
    type: 'error'
  },
  {
    inputs: [],
    name: 'InsufficientData',
    type: 'error'
  },
  {
    inputs: [],
    name: 'InvalidPeriod',
    type: 'error'
  },
  {
    inputs: [],
    name: 'AlreadyInitialized',
    type: 'error'
  },
  {
    inputs: [],
    name: 'NotInitialized',
    type: 'error'
  },
  {
    inputs: [],
    name: 'ZeroAddress',
    type: 'error'
  },
  {
    inputs: [],
    name: 'ElapsedTimeZero',
    type: 'error'
  },
  {
    inputs: [],
    name: 'InvalidTimeElapsed',
    type: 'error'
  }
] as const 