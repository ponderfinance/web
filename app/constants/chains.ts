import { type Chain } from 'viem';

export const bitkubChain = {
    id: 96,
    name: 'Bitkub',
    nativeCurrency: {
        decimals: 18,
        name: 'KUB',
        symbol: 'KUB',
    },
    rpcUrls: {
        default: { http: ['https://rpc.bitkubchain.io'] },
        public: { http: ['https://rpc.bitkubchain.io'] },
    },
    blockExplorers: {
        default: { name: 'Bkcscan', url: 'https://bkcscan.com' },
    },
    testnet: false,
} as const satisfies Chain;

export const bitkubTestnetChain = {
    id: 25925,
    name: 'Bitkub Testnet',
    nativeCurrency: {
        decimals: 18,
        name: 'KUB',
        symbol: 'KUB',
    },
    rpcUrls: {
        default: { http: ['https://rpc-testnet.bitkubchain.io'] },
        public: { http: ['https://rpc-testnet.bitkubchain.io'] },
    },
    blockExplorers: {
        default: { name: 'Bkcscan Testnet', url: 'https://testnet.bkcscan.com' },
    },
    testnet: true,
} as const satisfies Chain;

// Map ChainIds to chains
export const SUPPORTED_CHAINS = {
    96: bitkubChain,
    25925: bitkubTestnetChain,
} as const;

export type SupportedChainId = keyof typeof SUPPORTED_CHAINS;

// Helper to get chain from ChainId
export function getChainFromId(chainId: SupportedChainId) {
    const chain = SUPPORTED_CHAINS[chainId];
    if (!chain) throw new Error(`Chain ${chainId} not supported`);
    return chain;
}

// Helper to check if a chain is supported
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
    return chainId in SUPPORTED_CHAINS;
}

// Dynamic environment selection
export const CHAIN_ENV = process.env.REACT_APP_CHAIN_ENV || 'mainnet';
export const CURRENT_CHAIN = CHAIN_ENV === 'mainnet' ? bitkubChain : bitkubTestnetChain;
