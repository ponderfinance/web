'use client'

import React from 'react';
import { ResponsiveContainer, LineChart as RechartsLineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart as RechartsBarChart, Bar } from 'recharts';

export interface ChartPoint {
  x: Date;
  y: number;
}

interface LineChartProps {
  data: ChartPoint[];
  color?: string;
  showGrid?: boolean;
  showAxis?: boolean;
}

export const LineChart: React.FC<LineChartProps> = ({ 
  data, 
  color = '#8884d8',
  showGrid = true,
  showAxis = true
}) => {
  // Format data for recharts
  const chartData = data.map(point => ({
    date: point.x,
    value: point.y
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsLineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} />}
        
        {showAxis && (
          <>
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => new Date(date).toLocaleDateString()} 
              stroke="#777"
            />
            <YAxis stroke="#777" />
          </>
        )}
        
        <Tooltip 
          labelFormatter={(date) => new Date(date).toLocaleString()} 
          formatter={(value: any) => [`$${parseFloat(value).toFixed(4)}`, 'Price']}
          contentStyle={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: '4px' 
          }}
          itemStyle={{ color: '#fff' }}
          labelStyle={{ color: '#fff' }}
        />
        
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke={color} 
          dot={false}
          isAnimationActive={true}
          animationDuration={500}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
};

interface BarChartProps {
  data: ChartPoint[];
  color?: string;
  showGrid?: boolean;
  showAxis?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({ 
  data, 
  color = '#8884d8',
  showGrid = true,
  showAxis = false
}) => {
  // Format data for recharts
  const chartData = data.map(point => ({
    date: point.x,
    value: point.y
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.2} />}
        
        {showAxis && (
          <>
            <XAxis 
              dataKey="date" 
              tickFormatter={(date) => new Date(date).toLocaleDateString()} 
              stroke="#777"
            />
            <YAxis stroke="#777" />
          </>
        )}
        
        <Tooltip 
          labelFormatter={(date) => new Date(date).toLocaleString()} 
          formatter={(value: any) => [`$${parseFloat(value).toFixed(2)}`, 'Volume']}
          contentStyle={{ 
            backgroundColor: '#1a1a1a', 
            border: '1px solid #333',
            borderRadius: '4px' 
          }}
          itemStyle={{ color: '#fff' }}
          labelStyle={{ color: '#fff' }}
        />
        
        <Bar 
          dataKey="value" 
          fill={color} 
          opacity={0.8}
          isAnimationActive={true}
          animationDuration={500}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}; 