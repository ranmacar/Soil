import { cellToBoundary, cellToLatLng } from "h3-js";

const EARTH_M = 6_378_137;

export type Enu = { x: number; y: number; z: number };

export function cellOrigin(cell: string): { lat: number; lng: number } {
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}

/** Local meters: +x east, +y up, +z north. */
export function lngLatToEnu(
  lat: number,
  lng: number,
  originLat: number,
  originLng: number,
): Enu {
  const dLat = ((lat - originLat) * Math.PI) / 180;
  const dLng = ((lng - originLng) * Math.PI) / 180;
  const z = dLat * EARTH_M;
  const x = dLng * EARTH_M * Math.cos((originLat * Math.PI) / 180);
  return { x, y: 0, z };
}

export function hexRingEnu(cell: string): Enu[] {
  const origin = cellOrigin(cell);
  return cellToBoundary(cell, true).map(([lng, lat]) =>
    lngLatToEnu(lat, lng, origin.lat, origin.lng),
  );
}
