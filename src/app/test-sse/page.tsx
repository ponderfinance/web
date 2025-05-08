'use client';

import React, { useState, useEffect } from 'react';
import { View, Text, Button, Card, Divider } from 'reshaped';

export default function TestSSE() {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [sseState, setSSEState] = useState('Not connected');
  const [testResults, setTestResults] = useState<any>(null);
  
  // Function to add log entries
  const addLog = (message: string) => {
    setLogs(prev => [message, ...prev].slice(0, 50));
  };
  
  // Set up SSE connection
  useEffect(() => {
    addLog('Initializing SSE connection...');
    
    try {
      // Create EventSource for SSE
      const eventSource = new EventSource('/api/graphql-subscription');
      
      // Set up event handlers
      eventSource.onopen = () => {
        addLog('✅ SSE connection opened successfully');
        setConnected(true);
        setSSEState('Connected');
      };
      
      eventSource.onerror = (error) => {
        addLog(`❌ SSE connection error: ${JSON.stringify(error)}`);
        setConnected(false);
        setSSEState('Error');
      };
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`📨 Received SSE message: ${JSON.stringify(data)}`);
          setMessageCount(prev => prev + 1);
        } catch (e) {
          addLog(`⚠️ Received non-JSON message: ${event.data}`);
        }
      };
      
      // Clean up function
      return () => {
        addLog('Closing SSE connection');
        eventSource.close();
        setConnected(false);
      };
    } catch (error) {
      addLog(`❌ Error setting up SSE: ${error instanceof Error ? error.message : String(error)}`);
      setSSEState('Error');
    }
  }, []);
  
  // Function to trigger test event
  const triggerTestEvent = async () => {
    try {
      addLog('Triggering test event...');
      const response = await fetch('/api/test-sse');
      const data = await response.json();
      
      if (data.success) {
        addLog(`✅ Test event sent to ${data.sentTo} subscribers`);
        setTestResults(data);
      } else {
        addLog(`❌ Failed to send test event: ${data.error}`);
      }
    } catch (error) {
      addLog(`❌ Error triggering test event: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Function to set a direct Redis update
  const updateRedisDirectly = async () => {
    try {
      addLog('Setting Redis values directly...');
      
      const randomVolume = (Math.random() * 20 + 10).toFixed(2);
      const randomTVL = (Math.random() * 5000 + 2000).toFixed(2);
      const randomChange = (Math.random() * 20 - 10).toFixed(2);
      
      const response = await fetch('/api/test-sse');
      const data = await response.json();
      
      if (data.success) {
        addLog(`✅ Redis values updated and notification sent to ${data.sentTo} subscribers`);
        addLog(`   volume24h: ${data.testValues.volume24h}`);
        addLog(`   tvl: ${data.testValues.tvl}`);
        addLog(`   volume24hChange: ${data.testValues.volume24hChange}`);
      } else {
        addLog(`❌ Failed to update Redis: ${data.error}`);
      }
    } catch (error) {
      addLog(`❌ Error updating Redis: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  return (
    <View gap={4} padding={4}>
      <Card padding={4}>
        <View align="center" gap={4}>
          <Text variant="featured-1">SSE Connection Test</Text>
          
          <View gap={2} width="100%">
            <Text variant="body-3">Connection Status:</Text>
            <Text variant="body-1" color={connected ? 'positive' : 'critical'}>
              {sseState}
            </Text>
          </View>
          
          <View gap={2} width="100%">
            <Text variant="body-3">Messages Received:</Text>
            <Text variant="body-1">{messageCount}</Text>
          </View>
          
          <View direction="row" gap={2}>
            <Button
              variant="solid"
              onClick={triggerTestEvent}
              disabled={!connected}
            >
              Trigger Test Event
            </Button>
            
            <Button
              variant="outline"
              onClick={updateRedisDirectly}
              disabled={!connected}
            >
              Update Redis
            </Button>
          </View>
        </View>
      </Card>
      
      {testResults && (
        <Card padding={4}>
          <View gap={2}>
            <Text variant="featured-3">Last Test Event</Text>
            <Text variant="body-2">Sent to {testResults.sentTo} subscribers</Text>
            
            <Divider />
            
            <Text variant="body-3">Test Values:</Text>
            <View padding={2}>
              <pre style={{ margin: 0, overflow: 'auto' }}>
                {JSON.stringify(testResults.testValues, null, 2)}
              </pre>
            </View>
            
            <Text variant="body-3">Message Sent:</Text>
            <View padding={2}>
              <pre style={{ margin: 0, overflow: 'auto' }}>
                {JSON.stringify(JSON.parse(testResults.message), null, 2)}
              </pre>
            </View>
          </View>
        </Card>
      )}
      
      <Card padding={4}>
        <View gap={2}>
          <Text variant="featured-3">Event Log</Text>
          <View>
            {logs.map((log, index) => (
              <Text
                key={index}
                as="div"
                variant="body-3" 
              
              >
                [{new Date().toLocaleTimeString()}] {log}
              </Text>
            ))}
          </View>
        </View>
      </Card>
      
      <Card padding={4}>
        <View gap={2}>
          <Text variant="featured-3">Troubleshooting Guide</Text>
          
          <Text variant="body-2">If you're not seeing any events:</Text>
          
          <View gap={1} padding={0}>
            <Text variant="body-3">1. Check that an SSE connection is established in the Network tab</Text>
            <Text variant="body-3">2. Verify Redis connection is working</Text>
            <Text variant="body-3">3. Check server logs for any errors</Text>
            <Text variant="body-3">4. Make sure the Redis URL is the same between API routes and indexer</Text>
            <Text variant="body-3">5. Verify the GlobalProtocolMetricsSubscription component is mounted</Text>
          </View>
        </View>
      </Card>
    </View>
  );
} 