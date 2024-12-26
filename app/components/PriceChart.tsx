// import React, { useState, useEffect, useRef, useMemo } from 'react'
// import { usePriceHistory, usePairInfo } from '@ponderfinance/sdk'
// import {
//   ColorType,
//   createChart,
//   IChartApi,
//   ISeriesApi,
//   LineData,
//   Time,
// } from 'lightweight-charts'
//
// interface PriceChartProps {
//   pairAddress: `0x${string}`
// }
//
// const PriceChart: React.FC<PriceChartProps> = ({ pairAddress }) => {
//   const chartContainerRef = useRef<HTMLDivElement | null>(null)
//   const chartRef = useRef<IChartApi | null>(null)
//   const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
//   const resizeObserverRef = useRef<ResizeObserver | null>(null)
//   const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>(
//     '1h'
//   )
//
//   const { data: pairData, isLoading: isPairLoading } = usePairInfo(pairAddress)
//
//   // Use asPair() from pairData directly
//   const { data: priceHistory, isLoading: isPriceLoading } = usePriceHistory({
//     pair: pairData?.pair,
//     tokenIn: pairData?.token0 ?? '0x0000000000000000000000000000000000000000',
//     period: selectedTimeframe,
//     enabled: !!pairData,
//   })
//
//   // Format price for display
//   const formattedPrice = useMemo(() => {
//     if (!priceHistory?.currentPrice) return '$0.00'
//     return new Intl.NumberFormat('en-US', {
//       style: 'currency',
//       currency: 'USD',
//       minimumFractionDigits: 2,
//       maximumFractionDigits: 2,
//     }).format(priceHistory.currentPrice)
//   }, [priceHistory?.currentPrice])
//
//   // Initialize chart on mount
//   useEffect(() => {
//     if (!chartContainerRef.current) return
//
//     const chartOptions = {
//       width: chartContainerRef.current.clientWidth,
//       height: 400,
//       layout: {
//         background: { type: ColorType.Solid, color: '#1A1A1A' },
//         textColor: '#999999',
//       },
//       grid: {
//         vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
//         horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
//       },
//       timeScale: {
//         timeVisible: true,
//         secondsVisible: false,
//         borderColor: 'rgba(42, 46, 57, 0.5)',
//       },
//       rightPriceScale: {
//         borderColor: 'rgba(42, 46, 57, 0.5)',
//         scaleMargins: {
//           top: 0.1,
//           bottom: 0.1,
//         },
//       },
//     }
//
//     chartRef.current = createChart(chartContainerRef.current, chartOptions)
//     lineSeriesRef.current = chartRef.current.addLineSeries({
//       color: '#3773f5',
//       lineWidth: 2,
//       crosshairMarkerVisible: true,
//       priceLineVisible: false,
//       lastValueVisible: false,
//     })
//
//     // Setup resize observer
//     resizeObserverRef.current = new ResizeObserver((entries) => {
//       const { width } = entries[0].contentRect
//       if (chartRef.current) {
//         chartRef.current.applyOptions({ width })
//       }
//     })
//
//     resizeObserverRef.current.observe(chartContainerRef.current)
//
//     return () => {
//       resizeObserverRef.current?.disconnect()
//       if (chartRef.current) {
//         chartRef.current.remove()
//       }
//     }
//   }, [])
//
//   // Update chart data when price history changes
//   useEffect(() => {
//     if (!priceHistory?.points || !lineSeriesRef.current) return
//
//     const formattedData: LineData[] = priceHistory.points.map((point) => ({
//       time: point.timestamp as Time,
//       value: point.price,
//     }))
//
//     lineSeriesRef.current.setData(formattedData)
//   }, [priceHistory?.points])
//
//   if (isPairLoading) {
//     return (
//       <div className="flex justify-center items-center h-96">
//         Loading pair information...
//       </div>
//     )
//   }
//
//   if (!pairData) {
//     return (
//       <div className="flex justify-center items-center h-96">
//         Error loading pair information.
//       </div>
//     )
//   }
//
//   return (
//     <div className="price-chart w-full rounded-lg bg-[#1A1A1A] p-4">
//       <div className="flex flex-col gap-4">
//         <div className="flex justify-between items-center">
//           <div className="flex flex-col">
//             <h2 className="text-2xl font-bold text-white">{formattedPrice}</h2>
//             {priceHistory && (
//               <span
//                 className={`text-sm ${
//                   priceHistory.percentChange >= 0 ? 'text-green-500' : 'text-red-500'
//                 }`}
//               >
//                 {priceHistory.percentChange >= 0 ? '+' : ''}
//                 {priceHistory.percentChange.toFixed(2)}%
//               </span>
//             )}
//           </div>
//           <div className="flex gap-2">
//             {[
//               { label: '1H', value: '1h' },
//               { label: '1D', value: '24h' },
//               { label: '7D', value: '7d' },
//               { label: '1M', value: '30d' },
//             ].map((option) => (
//               <button
//                 key={option.value}
//                 onClick={() =>
//                   setSelectedTimeframe(option.value as '1h' | '24h' | '7d' | '30d')
//                 }
//                 className={`px-3 py-1 rounded ${
//                   selectedTimeframe === option.value
//                     ? 'bg-blue-500 text-white'
//                     : 'bg-[#2A2E39] text-gray-400 hover:bg-[#3A3E49]'
//                 } transition-colors`}
//               >
//                 {option.label}
//               </button>
//             ))}
//           </div>
//         </div>
//         <div ref={chartContainerRef} className="w-full h-96" />
//         {isPriceLoading && (
//           <div className="absolute inset-0 flex items-center justify-center bg-[#1A1A1A]/50">
//             Loading price data...
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }
//
// export default PriceChart
