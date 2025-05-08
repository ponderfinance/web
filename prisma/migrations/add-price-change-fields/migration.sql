-- Add missing price change fields to EntityMetrics
ALTER TABLE "EntityMetrics" 
ADD COLUMN IF NOT EXISTS "priceChange1h" FLOAT, -- Add 1h price change as Float instead of String
ALTER COLUMN "priceChange24h" TYPE FLOAT USING (CAST("priceChange24h" AS FLOAT)), -- Convert to Float if String
ADD COLUMN IF NOT EXISTS "priceChange7d" FLOAT; -- Add 7d price change as Float 