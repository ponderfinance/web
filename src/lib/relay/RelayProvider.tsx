'use client'

import { ReactNode, useMemo } from 'react'
import { RelayEnvironmentProvider } from 'react-relay'
import { getClientEnvironment } from './environment'
import { Environment } from 'relay-runtime'

// Define the props for our RelayProvider
type RelayProviderProps = {
  children: ReactNode
  initialRecords?: any
}

export default function RelayProvider({ children, initialRecords }: RelayProviderProps) {
  const environment = useMemo<Environment | null>(() => {
    // Only create the environment on the client side
    const env = getClientEnvironment()

    // If we have initial records from SSR and an environment, inject them
    if (env && initialRecords) {
      env.getStore().publish(initialRecords)
      env.getStore().notify()
    }

    return env
  }, [initialRecords])

  // If environment isn't available yet (during SSR), render children without the provider
  if (!environment) {
    return <>{children}</>
  }

  return (
    <RelayEnvironmentProvider environment={environment}>
      {children}
    </RelayEnvironmentProvider>
  )
}
