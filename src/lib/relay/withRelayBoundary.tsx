'use client';

import React, { useState, useEffect, ComponentType, Suspense } from 'react';
import { getClientEnvironment } from './environment';
import { Skeleton } from 'reshaped';
import { useRelayEnvironment } from 'react-relay';

// Helper for console logging
const logWithStyle = (message: string, type: 'success' | 'info' | 'error' | 'warning' = 'info') => {
  if (typeof window === 'undefined') return; // Skip in SSR
  
  const styles = {
    success: 'color: #00c853; font-weight: bold;',
    info: 'color: #2196f3; font-weight: bold;',
    error: 'color: #f44336; font-weight: bold;',
    warning: 'color: #ff9800; font-weight: bold;'
  };
  
  console.log(`%c${message}`, styles[type]);
};

// Fallback component to show while environment is initializing
const DefaultFallback = () => (
  <div className="p-4">
    <Skeleton width="100%" height="200px" />
  </div>
);

/**
 * A component that checks if the Relay environment is available
 * This helps prevent the "RelayEnvironmentProvider not found" error
 */
function EnvironmentChecker({ children }: { children: React.ReactNode }) {
  const [isEnvironmentAvailable, setIsEnvironmentAvailable] = useState(false);

  useEffect(() => {
    try {
      // Check if environment is available, will throw if not
      const env = getClientEnvironment();
      if (env) {
        setIsEnvironmentAvailable(true);
      }
    } catch (error) {
      console.error('Relay environment not available:', error);
    }
  }, []);

  if (!isEnvironmentAvailable) {
    return <DefaultFallback />;
  }

  return <>{children}</>;
}

/**
 * Higher-Order Component that provides a safety boundary for components requiring Relay
 * Ensures the component only renders when Relay environment is ready
 * 
 * @param Component The component that needs Relay
 * @param FallbackComponent Optional custom fallback to show during initialization
 * @returns A wrapped component that safely handles Relay availability
 */
export function withRelayBoundary<P extends object>(
  Component: ComponentType<P>,
  FallbackComponent = DefaultFallback
) {
  // Return a new component that wraps the original
  function WithRelayBoundary(props: P) {
    try {
      // Check if Relay environment is ready
      useRelayEnvironment();
      
      // If we get here, environment is ready - render with Suspense
      return (
        <Suspense fallback={<FallbackComponent />}>
          <Component {...props} />
        </Suspense>
      );
    } catch (error) {
      // If we're in development, log the error
      if (process.env.NODE_ENV !== 'production') {
        console.error('Relay environment not ready:', error);
      }
      
      // Show the fallback
      return <FallbackComponent />;
    }
  }
  
  WithRelayBoundary.displayName = `withRelayBoundary(${Component.displayName || Component.name || 'Component'})`;
  return WithRelayBoundary;
}

export default withRelayBoundary; 