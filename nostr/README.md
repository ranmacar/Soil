# Soil / nostr

Nostr-first SOIL: community for distributing ideas, store for buying products and IP, and the regenerative tower game as one idea in that catalog.

Parent repo: `ranmacar/Soil` (Cardano/Cloudflare prototype stays at repo root). This package is the next-era stack.

## Locked direction

- **Community first** on Nostr — ideas circulate as events; deploy static apps via Blossom + nsite when ready.
- **Store** — buy products and/or IP; FTO zone with a FRAND-like license for in-repo IP; fractional, tradable IP; ~5% of each sale → IP pool (importance-weighted; algorithm TBD).
- **Game** — one idea + in-game products mapped to store SKUs. Simultaneous single-player on a shared real map; slow interactions via Nostr.
- **Spatial** — H3 res 10 cells (~1 ha game abstraction) as tower sites; start by claiming a free cell.
- **Tech lean** — Vite + TypeScript; sim package separate from renderers; MapLibre + PMTiles (open map); Babylon.js for 3D; `h3-js`; Nostr first (WebRTC later if needed).

## Status

Scaffold only. See `PLAN.md`.
