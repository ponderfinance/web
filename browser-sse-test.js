// Browser-side diagnostic script for SSE connection
// Copy and paste this script into your browser console

console.log('===== BROWSER-SIDE SSE DIAGNOSTIC =====');

// Check if EventSource is available
if (typeof EventSource === 'undefined') {
  console.error('❌ ERROR: EventSource not supported in this browser');
} else {
  console.log('✅ EventSource is available in this browser');
}

// Check if we have an existing SSE connection
let existingConnections = 0;
if (performance && performance.getEntriesByType) {
  const resources = performance.getEntriesByType('resource');
  for (const resource of resources) {
    if (resource.name.includes('/api/graphql-subscription')) {
      existingConnections++;
    }
  }
  
  console.log(`Found ${existingConnections} existing SSE connections`);
}

// Test creating a new SSE connection
console.log('\nCreating test SSE connection...');
const sse = new EventSource('/api/graphql-subscription');

// Connection state
console.log(`SSE readyState: ${sse.readyState} (0=connecting, 1=open, 2=closed)`);

// Setup event handlers
sse.onopen = function() {
  console.log('✅ SSE connection opened successfully');
  console.log(`SSE readyState after open: ${sse.readyState}`);
};

sse.onerror = function(error) {
  console.error('❌ SSE connection error:', error);
  console.log(`SSE readyState after error: ${sse.readyState}`);
};

let messageCount = 0;
sse.onmessage = function(event) {
  messageCount++;
  console.log(`✅ SSE message received (#${messageCount}):`);
  try {
    const data = JSON.parse(event.data);
    console.log('  Parsed message:', data);
    
    // Check for expected message properties
    if (data.type) {
      console.log(`  Message type: ${data.type}`);
    }
    
    if (data.payload) {
      console.log('  Message payload:', data.payload);
    }
  } catch (e) {
    console.log('  Raw message:', event.data);
  }
};

// Show instructions for testing
console.log('\nSSE connection established and awaiting messages...');
console.log('To test subscription system manually:');
console.log('1. Run the debug-subscription-flow.js script from the terminal');
console.log('2. Look for messages appearing here in the browser console');
console.log('3. If no messages appear, check the network tab for the SSE connection status');

// Function to manually close the connection
console.log('\nTo close this test connection, run:');
console.log('closeSSE()');

window.closeSSE = function() {
  sse.close();
  console.log('SSE test connection closed');
  console.log(`Final SSE readyState: ${sse.readyState}`);
}; 