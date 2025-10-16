'use client'

import React, { ReactNode } from 'react'
import { View, ViewProps } from 'reshaped'

export interface ScrollableTableProps extends ViewProps {
  children: ReactNode;
  minWidth?: string;
  maxHeight?: string;
}

/**
 * A component that wraps table content to provide horizontal scrolling without visible scrollbars
 * Used for tables in explore pages to prevent column squishing on narrow screens
 */
export const ScrollableTable: React.FC<ScrollableTableProps> = ({
  children,
  minWidth = '900px',
  maxHeight,
  ...props
}) => {
  return (
    <View
      borderRadius="medium"
      borderColor="neutral-faded"
      width="100%"
      overflow="hidden"
      {...props}
    >
      {/* Outer container with defined width and max height */}
      <View
        width="100%"
        overflow="auto"
        className="hide-scrollbar"
        attributes={{
          style: {
            scrollbarWidth: 'none',  /* Firefox */
            msOverflowStyle: 'none',  /* IE and Edge */
            ...(maxHeight ? { maxHeight } : {})
          }
        }}
      >
        {/* Inner container with min-width */}
        <View
          width="100%"
          attributes={{ 
            style: { 
              minWidth,
            }
          }}
        >
          <style jsx global>{`
            .hide-scrollbar::-webkit-scrollbar {
              display: none;  /* Chrome, Safari, Opera */
            }
            .hide-scrollbar {
              -ms-overflow-style: none;  /* IE and Edge */
              scrollbar-width: none;  /* Firefox */
            }
          `}</style>
          {children}
        </View>
      </View>
    </View>
  )
}

export default ScrollableTable 