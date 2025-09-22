# Arkus Worker (Railway)

Worker HTTP service to run scraping scripts outside Vercel.

## Endpoints
- POST /amadeus { latitude, longitude, radius?, keyword?, userUuid?, saveToDb? }
- POST /hotel { userUuid, hotelName, days?, concurrency?, headless?, userJwt? }
- POST /events { latitude?, longitude?, radius?, userJwt? }

All requests must include header: `x-api-key: <WORKER_API_KEY>`.

## Environment Variables
- WORKER_API_KEY: shared secret to authorize calls from Vercel
- SUPABASE_URL, SUPABASE_ANON_KEY
- AMADEUS_API_KEY, AMADEUS_API_SECRET
- (optional) USER_JWT passed per-request as body field if needed

## Deploy on Railway
1. `railway init` (or deploy from dashboard, pick Docker)
2. Point to `worker/` as the root for the service
3. Set environment variables above in Railway
4. Deploy. Copy the public URL (e.g. https://arkus-worker.up.railway.app)

## Local run
```
cd worker
npm install
WORKER_API_KEY=devkey SUPABASE_URL=... SUPABASE_ANON_KEY=... node server/index.js
```
