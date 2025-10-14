import Database from 'better-sqlite3'

const db = new Database('/Users/milesxb/dev/ponder/ponder-indexer-v2/.ponder/sqlite/public.db', { readonly: true })

console.log('\n=== PROTOCOL METRICS ===')
const metrics = db.prepare('SELECT volume_1h, daily_volume_usd, volume_24h_change, volume_1h_change, timestamp FROM "ProtocolMetric" ORDER BY timestamp DESC LIMIT 3').all()
console.log(metrics)

console.log('\n=== PAIR VOLUMES (Sample) ===')
const pairs = db.prepare('SELECT address, volume_24h, volume_change_24h, pool_apr FROM "Pair" WHERE volume_24h > 0 ORDER BY volume_24h DESC LIMIT 3').all()
console.log(pairs)

console.log('\n=== TOKEN VOLUMES (Sample) ===')
const tokens = db.prepare('SELECT symbol, volume_usd_24h, volume_change_24h FROM "Token" WHERE volume_usd_24h > 0 ORDER BY volume_usd_24h DESC LIMIT 3').all()
console.log(tokens)

db.close()
