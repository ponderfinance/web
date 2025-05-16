import { useState, useEffect, useCallback, useRef } from 'react';
import { useRedisSubscriber } from '@/src/providers/RedisSubscriberProvider';
import { shouldRefresh, markRefreshComplete } from '@/src/lib/utils/throttleRefresh';
import { isAddress } from 'viem';

interface TokenData {
  id?: string;
  address: string;
  name?: string | null;
  symbol?: string | null;
  imageURI?: string | null;
  priceUSD?: string | null;
  priceChange24h?: number | null;
  decimals?: number | null;
  volumeUSD24h?: string | null;
  tvl?: string | null;
  marketCap?: string | null;
  fdv?: string | null;
}

interface PriceDataPoint {
  time: number;
  value: number;
}

interface UseTokenDataOptions {
  initialTimeframe?: string;
  autoRefreshInterval?: number; // in ms, default 60000 (1 minute)
  skipInitialLoading?: boolean;
}

interface TokenDataState {
  tokenData: TokenData;
  priceData: PriceDataPoint[];
  isLoadingBasic: boolean;
  isLoadingPrice: boolean;
  isLoadingStats: boolean;
  isLoadingChart: boolean;
  error: string | null;
  activeTimeframe: string;
  setActiveTimeframe: (timeframe: string) => void;
  refreshData: (options?: { skipLoading?: boolean }) => Promise<void>;
}

/**
 * Custom hook for managing token data with proper throttling and Redis updates
 */
export default function useTokenData(
  tokenAddress: string,
  options: UseTokenDataOptions = {}
): TokenDataState {
  const normalizedAddress = tokenAddress.toLowerCase();
  const { tokenLastUpdated } = useRedisSubscriber();
  
  // Default options
  const {
    initialTimeframe = '1m',
    autoRefreshInterval = 60000,
    skipInitialLoading = false,
  } = options;
  
  // State for token data
  const [tokenData, setTokenData] = useState<TokenData>({
    address: normalizedAddress,
  });
  
  // State for price chart data
  const [priceData, setPriceData] = useState<PriceDataPoint[]>([]);
  
  // State for active timeframe
  const [activeTimeframe, setActiveTimeframe] = useState(initialTimeframe);
  
  // Loading states
  const [isLoadingBasic, setIsLoadingBasic] = useState(!skipInitialLoading);
  const [isLoadingPrice, setIsLoadingPrice] = useState(!skipInitialLoading);
  const [isLoadingStats, setIsLoadingStats] = useState(!skipInitialLoading);
  const [isLoadingChart, setIsLoadingChart] = useState(!skipInitialLoading);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Track mounted state to prevent state updates after unmount
  const isMounted = useRef(true);
  
  // Fetch basic token info (name, symbol, image)
  const fetchBasicInfo = useCallback(async (skipLoading = false) => {
    if (!isAddress(normalizedAddress)) {
      setError('Invalid token address');
      return;
    }
    
    if (!skipLoading) setIsLoadingBasic(true);
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query TokenBasicInfoQuery($tokenAddress: String!) {
              tokenByAddress(address: $tokenAddress) {
                name
                symbol
                imageURI
              }
            }
          `,
          variables: { tokenAddress: normalizedAddress },
        }),
      });
      
      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors fetching basic token info:', result.errors);
        return;
      }
      
      if (isMounted.current && result.data?.tokenByAddress) {
        setTokenData(prev => ({
          ...prev,
          name: result.data.tokenByAddress.name || null,
          symbol: result.data.tokenByAddress.symbol || null,
          imageURI: result.data.tokenByAddress.imageURI || null,
        }));
      }
    } catch (err) {
      console.error('Error fetching basic token info:', err);
      if (isMounted.current) setError('Failed to load token information');
    } finally {
      if (isMounted.current && !skipLoading) setIsLoadingBasic(false);
      markRefreshComplete(`token-basic-${normalizedAddress}`);
    }
  }, [normalizedAddress]);
  
  // Fetch price data
  const fetchPriceData = useCallback(async (skipLoading = false) => {
    if (!isAddress(normalizedAddress)) return;
    
    if (!skipLoading) setIsLoadingPrice(true);
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query TokenPriceQuery($tokenAddress: String!) {
              tokenByAddress(address: $tokenAddress) {
                priceUSD
                priceChange24h
                decimals
              }
            }
          `,
          variables: { tokenAddress: normalizedAddress },
        }),
      });
      
      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors fetching price data:', result.errors);
        return;
      }
      
      if (isMounted.current && result.data?.tokenByAddress) {
        setTokenData(prev => ({
          ...prev,
          priceUSD: result.data.tokenByAddress.priceUSD || null,
          priceChange24h: result.data.tokenByAddress.priceChange24h || null,
          decimals: result.data.tokenByAddress.decimals || null,
        }));
      }
    } catch (err) {
      console.error('Error fetching price data:', err);
    } finally {
      if (isMounted.current && !skipLoading) setIsLoadingPrice(false);
      markRefreshComplete(`token-price-${normalizedAddress}`);
    }
  }, [normalizedAddress]);
  
  // Fetch token stats
  const fetchTokenStats = useCallback(async (skipLoading = false) => {
    if (!isAddress(normalizedAddress)) return;
    
    if (!skipLoading) setIsLoadingStats(true);
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query TokenStatsQuery($tokenAddress: String!) {
              tokenByAddress(address: $tokenAddress) {
                id
                volumeUSD24h
                tvl
                marketCap
                fdv
              }
            }
          `,
          variables: { tokenAddress: normalizedAddress },
        }),
      });
      
      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors fetching token stats:', result.errors);
        return;
      }
      
      if (isMounted.current && result.data?.tokenByAddress) {
        setTokenData(prev => ({
          ...prev,
          id: result.data.tokenByAddress.id || undefined,
          volumeUSD24h: result.data.tokenByAddress.volumeUSD24h || null,
          tvl: result.data.tokenByAddress.tvl || null,
          marketCap: result.data.tokenByAddress.marketCap || null,
          fdv: result.data.tokenByAddress.fdv || null,
        }));
      }
    } catch (err) {
      console.error('Error fetching token stats:', err);
    } finally {
      if (isMounted.current && !skipLoading) setIsLoadingStats(false);
      markRefreshComplete(`token-stats-${normalizedAddress}`);
    }
  }, [normalizedAddress]);
  
  // Fetch chart data
  const fetchChartData = useCallback(async (skipLoading = false) => {
    if (!isAddress(normalizedAddress)) return;
    
    if (!skipLoading) setIsLoadingChart(true);
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            query TokenPriceChartQuery($tokenAddress: String!, $timeframe: String!, $limit: Int!) {
              tokenPriceChart(tokenAddress: $tokenAddress, timeframe: $timeframe, limit: $limit) {
                time
                value
              }
            }
          `,
          variables: { 
            tokenAddress: normalizedAddress,
            timeframe: activeTimeframe,
            limit: 100
          },
        }),
      });
      
      const result = await response.json();
      
      if (result.errors) {
        console.error('GraphQL errors fetching chart data:', result.errors);
        return;
      }
      
      if (isMounted.current && result.data?.tokenPriceChart) {
        // Basic chart data formatting
        const formattedData = result.data.tokenPriceChart.map((point: any) => ({
          time: Number(point.time),
          value: Number(point.value)
        }));
        
        setPriceData(formattedData);
      }
    } catch (err) {
      console.error('Error fetching chart data:', err);
    } finally {
      if (isMounted.current && !skipLoading) setIsLoadingChart(false);
      markRefreshComplete(`token-chart-${normalizedAddress}`);
    }
  }, [normalizedAddress, activeTimeframe]);
  
  // Unified refresh function for all data
  const refreshData = useCallback(async (options?: { skipLoading?: boolean }) => {
    const skipLoading = options?.skipLoading ?? true;
    
    // Update price data - highest priority, most frequently changing
    if (shouldRefresh(`token-price-${normalizedAddress}`, 'high')) {
      fetchPriceData(skipLoading);
    }
    
    // Update chart data - medium priority
    if (shouldRefresh(`token-chart-${normalizedAddress}`, 'medium')) {
      fetchChartData(skipLoading);
    }
    
    // Update token stats - lower priority
    if (shouldRefresh(`token-stats-${normalizedAddress}`, 'low')) {
      fetchTokenStats(skipLoading);
    }
    
    // Basic info rarely changes, only refresh occasionally
    if (shouldRefresh(`token-basic-${normalizedAddress}`, 'low', 300000)) { // 5 minutes
      fetchBasicInfo(skipLoading);
    }
  }, [normalizedAddress, fetchPriceData, fetchChartData, fetchTokenStats, fetchBasicInfo]);
  
  // Initial data loading
  useEffect(() => {
    if (isAddress(normalizedAddress)) {
      fetchBasicInfo();
      fetchPriceData();
      fetchTokenStats();
      fetchChartData();
    }
    
    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [normalizedAddress, fetchBasicInfo, fetchPriceData, fetchTokenStats, fetchChartData]);
  
  // Auto-refresh on interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (isAddress(normalizedAddress)) {
        refreshData({ skipLoading: true });
      }
    }, autoRefreshInterval);
    
    return () => clearInterval(intervalId);
  }, [normalizedAddress, refreshData, autoRefreshInterval]);
  
  // Redis update listener 
  useEffect(() => {
    if (tokenLastUpdated[normalizedAddress] && isAddress(normalizedAddress)) {
      console.log(`[useTokenData] Redis update detected for ${normalizedAddress}`);
      refreshData({ skipLoading: true });
    }
  }, [tokenLastUpdated, normalizedAddress, refreshData]);
  
  // Handle timeframe changes
  useEffect(() => {
    if (isAddress(normalizedAddress)) {
      fetchChartData();
    }
  }, [activeTimeframe, fetchChartData, normalizedAddress]);
  
  return {
    tokenData,
    priceData,
    isLoadingBasic,
    isLoadingPrice,
    isLoadingStats,
    isLoadingChart, 
    error,
    activeTimeframe,
    setActiveTimeframe,
    refreshData
  };
} 