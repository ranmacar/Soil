# Soil / nostr

Nostr-first SOIL: community for distributing ideas, store for buying products and IP, and the regenerative tower game as one idea in that catalog.

Parent repo: `ranmacar/Soil` (Cardano/Cloudflare prototype stays at repo root). This package is the next-era stack.

## Current first goal

A phone-local MapLibre map that opens on your GPS position.

```sh
cd nostr
npm install
npm run dev
```

On Termux, native Rollup cannot `dlopen` inside PRoot. The workspace pins `@rollup/wasm-node` so Vite still starts.

Then open **http://127.0.0.1:5173** in Chrome (or from Termux: `termux-open-url http://127.0.0.1:5173`). Use localhost, not the LAN IP — browsers block geolocation on plain HTTP except on `127.0.0.1` / `localhost`. Allow location when prompted.

Pan and pinch-zoom as usual. The crosshair control recenters on you.

At zoom 13+ an H3 res-10 hex grid overlays the map. Tap a hex to fade into a pitched 3D view of that cell (satellite + terrain). Close or press Escape to return.

If `VITE_GOOGLE_TILES_API_KEY` (or `?key=`) is set, that 3D view uses Google Photorealistic 3D Tiles instead. Enable Map Tiles API in Google Cloud; copy `apps/web/.env.example` to `apps/web/.env` and restart Vite.

If the browser refuses geolocation, the Vite server tries `termux-location` (needs the Termux:API app + location permission). Last successful coordinate is remembered for the next launch.

## Locked direction

- **Community first** on Nostr — ideas circulate as events; deploy static apps via Blossom + nsite when ready.
- **Store** — buy products and/or IP; FTO zone with a FRAND-like license for in-repo IP; fractional, tradable IP; ~5% of each sale → IP pool (importance-weighted; algorithm TBD).
- **Game** — one idea + in-game products mapped to store SKUs. Simultaneous single-player on a shared real map; slow interactions via Nostr.
- **Spatial** — H3 res 10 cells (~1 ha game abstraction) as tower sites; start by claiming a free cell.
- **Tech lean** — Vite + TypeScript; sim package separate from renderers; MapLibre + PMTiles (open map); Babylon.js for 3D; `h3-js`; Nostr first (WebRTC later if needed).

## Status

First map slice lives in `apps/web`. See `PLAN.md`.
