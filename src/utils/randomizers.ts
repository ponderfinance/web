import { keccak256, toBytes } from 'viem'

export const getHexNonce = () => keccak256(toBytes(Math.round(Math.random() * 1000)))
