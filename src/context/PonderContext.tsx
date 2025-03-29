'use client'

import { createContext, useContext, ReactNode } from 'react'
import { PonderSDK } from '@ponderfinance/sdk'

const PonderContext = createContext<PonderSDK | undefined>(undefined)

interface PonderProviderProps {
  children: ReactNode
  sdk: PonderSDK
}

export function PonderProvider({ children, sdk }: PonderProviderProps) {
  return (
    <PonderContext.Provider value={sdk}>
      {children}
    </PonderContext.Provider>
  )
}

export function usePonderSDK(): PonderSDK {
  const context = useContext(PonderContext)
  if (!context) {
    throw new Error('usePonderSDK must be used within a PonderProvider')
  }
  return context
}

export { PonderContext } 