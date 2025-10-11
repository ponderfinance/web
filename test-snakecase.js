// Test the toSnakeCase function - FIXED VERSION
function toSnakeCase(str) {
  return str
    .replace(/USD/g, 'Usd')
    .replace(/TVL/g, 'Tvl')
    .replace(/URI/g, 'Uri')
    .replace(/([A-Z])(\d)/g, '$1_$2')     // Capital before digit: Usd24h → Usd_24h
    .replace(/(\d)([A-Z])/g, '$1_$2')     // Digit before capital: token0Address → token0_Address
    .replace(/([a-z])([A-Z])/g, '$1_$2')  // Lowercase before capital: camelCase → camel_Case
    .toLowerCase();
}

console.log('Testing toSnakeCase conversions:');
console.log('token0Address =>', toSnakeCase('token0Address'), '(should be token0_address)');
console.log('token1Address =>', toSnakeCase('token1Address'), '(should be token1_address)');
console.log('volumeUSD24h =>', toSnakeCase('volumeUSD24h'), '(should be volume_usd_24h)');
console.log('volume24h =>', toSnakeCase('volume24h'), '(should be volume24h)');
console.log('priceUSD =>', toSnakeCase('priceUSD'), '(should be price_usd)');
console.log('reserve0 =>', toSnakeCase('reserve0'), '(should be reserve0)');
console.log('reserve1 =>', toSnakeCase('reserve1'), '(should be reserve1)');