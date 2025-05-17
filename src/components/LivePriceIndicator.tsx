'use client'

import React, { useEffect, useState } from 'react'
import { View } from 'reshaped'
import styles from './LivePriceIndicator.module.css'

interface LivePriceIndicatorProps {
  isActive: boolean;
  pulseTrigger: number | null;
  color?: string;
  size?: number;
}

export const LivePriceIndicator: React.FC<LivePriceIndicatorProps> = ({
  isActive,
  pulseTrigger,
  color = '#4caf50', // Default green
  size = 8
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  
  // Trigger pulse animation when pulseTrigger changes
  useEffect(() => {
    if (!isActive || !pulseTrigger) return;
    
    setIsPulsing(true);
    const timer = setTimeout(() => {
      setIsPulsing(false);
    }, 1000); // 1 second pulse
    
    return () => clearTimeout(timer);
  }, [pulseTrigger, isActive]);
  
  if (!isActive) return null;
  
  // Use Reshaped View component with attributes prop for custom styling
  return (
    <View
      className={`${styles.indicator} ${isPulsing ? styles.pulse : ''}`}
      attributes={{
        style: {
          width: size,
          height: size,
          backgroundColor: color,
          borderRadius: '50%'
        }
      }}
    />
  );
};

export default LivePriceIndicator; 