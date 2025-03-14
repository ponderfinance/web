'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button, Text, View } from 'reshaped'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // You can log the error to an error reporting service
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        this.props.fallback || (
          <View
            direction="column"
            gap={4}
            padding={8}
            borderRadius="large"
            borderColor="critical"
            backgroundColor="critical-faded"
          >
            <Text variant="title-4" color="critical">
              Something went wrong
            </Text>
            <Text variant="body-2" color="critical">
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <Button onClick={() => this.setState({ hasError: false })}>Try again</Button>
          </View>
        )
      )
    }

    return this.props.children
  }
}
