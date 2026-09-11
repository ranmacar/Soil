# Soil/nostr — plan

## Current first goal

Run on this Galaxy (Termux) a scrollable MapLibre map that starts at the phone's location.

- App: `nostr/apps/web` (`npm run dev` from `nostr/`)
- Tiles: OpenFreeMap (no API key)
- Location: browser geolocation, then Termux `termux-location` if the browser blocks it
- H3 res-10 overlay on the MapLibre map (here cell + tap to select)
- Three modes on the same hex: **Map** (2D choose) → **Look** (3D architecture on tiles) → **Walk** (Babylon, enter the pod)
- Out of scope for this slice: Nostr events, H3 claims, store

## North star

Publish open regenerative settlement patterns (midrise towers that scale people while improving ecosystems). SOIL is the collaboration + marketplace path; the game is a living prospectus and product surface. Real builds happen through collaborators; SOIL does not require Martin to personally permit the first tower.

## Product shape

1. **Nostr community** — identity, idea distribution, shared map gossip (claims, slow interactions).
2. **Store** — Alibaba-scale ambition with an IP layer: buy the thing and/or the IP behind it.
3. **Game** — Synthree pod awakens on a chosen H3 cell; roof → dig → rise; pod relocates; products purchasable in-game tie back to SOIL.

## Story (game)

Survived solar-flare cataclysm; pod activates nearby; learn systems, deploy agriculture, expand with assignable survivors (heroes later). Arbolis lore stays light in v1.

## Architecture (v1)

```
nostr/
  packages/sim/      # pure TS: cells, pods, towers, people, power, quests
  packages/net/      # Nostr client: claims, events, store hooks
  apps/web/          # MapLibre 2D + Babylon 3D renderers
  docs/              # IP/FRAND notes, event kinds
```

- One geo simulation; multiple renderers.
- Local sim authoritative for your settlement; Nostr is the shared noticeboard.
- Map tiles: MapLibre + PMTiles/OSM (not Mapbox metering).

## Out of scope for first slice

- Full FRAND importance algorithm
- WebRTC live presence
- Cardano/BIT/DOVS (lives in parent Soil for now)
- Shipping physical logistics

## First playable slice (when we build)

Pick free H3 res-10 → mini-quests (solar roof shelter → dig water/materials → rise floors) → claim visible on shared Nostr map.
