// KKUB addresses for each chain
import { Address } from 'viem'

export const KKUB_ADDRESS: Record<25925 | 96, Address> = {
  25925: '0xBa71efd94be63bD47B78eF458DE982fE29f552f7',
  96: '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5',
} as const

export const KOI_ADDRESS: Record<25925 | 96, Address> = {
    25925: '0x33C9B02596d7b1CB4066cC2CeEdd37f3A7c7Aa07',
    96: '0xe0432224871917fb5a137f4a153a51ecf9f74f57',
} as const

export const ORACLE_ADDRESS: Record<25925 | 96, Address> = {
  25925: '0xce1fdA5AC44f495321C163103B11916933851B83', // Testnet
  96: '0xcf814870800a3bcac4a6b858424a9370a64c75ad', // Mainnet
} as const
