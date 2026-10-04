# Pulse — mini World Monitor

Real-time global events dashboard: earthquakes, wildfires, storms, volcanoes and world news on one live map, with AI-generated briefs and personal watchlists.

Inspired by [koala73/worldmonitor](https://github.com/koala73/worldmonitor). Built with Claude Code using parallel agents.

**Stack (all free tier):** Next.js 16 · Supabase (Postgres, Auth, Realtime, pg_cron) · Leaflet + OpenStreetMap · Recharts · Vercel

**Data sources:** USGS Earthquakes · NASA EONET · GDELT · world news RSS

## Local setup
```bash
npm install
cp .env.example .env.local   # fill in Supabase keys + CRON_SECRET
npm run dev
# trigger ingestion manually:
curl -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/ingest
```
