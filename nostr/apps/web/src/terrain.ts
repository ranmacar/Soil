import { cellOrigin } from "./geo";

const EARTH_M = 6_378_137;
const DEM_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const SAT_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export type TerrainPatch = {
  size: number;
  cells: number;
  originHeight: number;
  heights: Float32Array;
  texture: HTMLCanvasElement | null;
};

const cache = new Map<string, Promise<TerrainPatch>>();

function tileX(lng: number, z: number): number {
  return ((lng + 180) / 360) * 2 ** z;
}

function tileY(lat: number, z: number): number {
  const s = Math.sin((lat * Math.PI) / 180);
  return (
    (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
  );
}

function latLngFromEnu(
  originLat: number,
  originLng: number,
  x: number,
  z: number,
): { lat: number; lng: number } {
  const lat = originLat + (z / EARTH_M) * (180 / Math.PI);
  const lng =
    originLng +
    (x / (EARTH_M * Math.cos((originLat * Math.PI) / 180))) * (180 / Math.PI);
  return { lat, lng };
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const src = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(url));
      el.src = src;
    });
    URL.revokeObjectURL(src);
    return img;
  } catch {
    return null;
  }
}

function terrariumMeters(data: Uint8ClampedArray, idx: number): number {
  const r = data[idx] ?? 0;
  const g = data[idx + 1] ?? 0;
  const b = data[idx + 2] ?? 0;
  return r * 256 + g + b / 256 - 32768;
}

type Raster = { z: number; x: number; y: number; canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

async function loadTileGrid(
  urlTemplate: string,
  z: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): Promise<Map<string, Raster>> {
  const out = new Map<string, Raster>();
  const jobs: Promise<void>[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const url = urlTemplate
        .replace("{z}", String(z))
        .replace("{x}", String(x))
        .replace("{y}", String(y));
      jobs.push(
        loadImage(url).then((img) => {
          if (!img) return;
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (!ctx) return;
          ctx.drawImage(img, 0, 0);
          out.set(`${z}/${x}/${y}`, { z, x, y, canvas, ctx });
        }),
      );
    }
  }
  await Promise.all(jobs);
  return out;
}

function sampleTerrarium(
  tiles: Map<string, Raster>,
  z: number,
  lat: number,
  lng: number,
): number | null {
  const fx = tileX(lng, z);
  const fy = tileY(lat, z);
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  const tile = tiles.get(`${z}/${tx}/${ty}`);
  if (!tile) return null;
  const px = (fx - tx) * tile.canvas.width;
  const py = (fy - ty) * tile.canvas.height;
  const ix = Math.min(tile.canvas.width - 1, Math.max(0, Math.floor(px)));
  const iy = Math.min(tile.canvas.height - 1, Math.max(0, Math.floor(py)));
  const img = tile.ctx.getImageData(ix, iy, 1, 1).data;
  return terrariumMeters(img, 0);
}

export function samplePatch(patch: TerrainPatch, x: number, z: number): number {
  const { size, cells, heights } = patch;
  const u = ((x + size / 2) / size) * (cells - 1);
  const v = ((z + size / 2) / size) * (cells - 1);
  const x0 = Math.max(0, Math.min(cells - 2, Math.floor(u)));
  const z0 = Math.max(0, Math.min(cells - 2, Math.floor(v)));
  const tx = u - x0;
  const tz = v - z0;
  const h00 = heights[z0 * cells + x0] ?? 0;
  const h10 = heights[z0 * cells + x0 + 1] ?? h00;
  const h01 = heights[(z0 + 1) * cells + x0] ?? h00;
  const h11 = heights[(z0 + 1) * cells + x0 + 1] ?? h00;
  return h00 * (1 - tx) * (1 - tz) + h10 * tx * (1 - tz) + h01 * (1 - tx) * tz + h11 * tx * tz;
}

export async function loadTerrainPatch(
  cell: string,
  size = 180,
  cells = 65,
): Promise<TerrainPatch> {
  const hit = cache.get(cell);
  if (hit) return hit;
  const job = (async () => {
    const origin = cellOrigin(cell);
    const zDem = 15;
    const zSat = 17;
    const corners = [
      latLngFromEnu(origin.lat, origin.lng, -size / 2, -size / 2),
      latLngFromEnu(origin.lat, origin.lng, size / 2, -size / 2),
      latLngFromEnu(origin.lat, origin.lng, -size / 2, size / 2),
      latLngFromEnu(origin.lat, origin.lng, size / 2, size / 2),
    ];
    const xs = corners.map((c) => tileX(c.lng, zDem));
    const ys = corners.map((c) => tileY(c.lat, zDem));
    const demTiles = await loadTileGrid(
      DEM_URL,
      zDem,
      Math.floor(Math.min(...xs)),
      Math.floor(Math.min(...ys)),
      Math.floor(Math.max(...xs)),
      Math.floor(Math.max(...ys)),
    );

    const heights = new Float32Array(cells * cells);
    let originHeight = 0;
    for (let iz = 0; iz < cells; iz++) {
      for (let ix = 0; ix < cells; ix++) {
        const x = -size / 2 + (ix / (cells - 1)) * size;
        const z = -size / 2 + (iz / (cells - 1)) * size;
        const ll = latLngFromEnu(origin.lat, origin.lng, x, z);
        const h = sampleTerrarium(demTiles, zDem, ll.lat, ll.lng) ?? 0;
        heights[iz * cells + ix] = h;
        if (ix === Math.floor(cells / 2) && iz === Math.floor(cells / 2)) {
          originHeight = h;
        }
      }
    }
    for (let i = 0; i < heights.length; i++) heights[i] -= originHeight;

    let texture: HTMLCanvasElement | null = null;
    try {
      const sw = latLngFromEnu(origin.lat, origin.lng, -size / 2, -size / 2);
      const ne = latLngFromEnu(origin.lat, origin.lng, size / 2, size / 2);
      const west = tileX(sw.lng, zSat);
      const east = tileX(ne.lng, zSat);
      const north = tileY(ne.lat, zSat);
      const south = tileY(sw.lat, zSat);
      const satTiles = await loadTileGrid(
        SAT_URL,
        zSat,
        Math.floor(Math.min(west, east)),
        Math.floor(Math.min(north, south)),
        Math.floor(Math.max(west, east)),
        Math.floor(Math.max(north, south)),
      );
      if (satTiles.size > 0) {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const spanX = east - west || 1;
          const spanY = south - north || 1;
          for (const tile of satTiles.values()) {
            const dx = ((tile.x - west) / spanX) * canvas.width;
            const dy = ((tile.y - north) / spanY) * canvas.height;
            const dw = canvas.width / spanX;
            const dh = canvas.height / spanY;
            ctx.drawImage(tile.canvas, dx, dy, dw, dh);
          }
          texture = canvas;
        }
      }
    } catch {
      texture = null;
    }

    return { size, cells, originHeight, heights, texture };
  })();
  cache.set(cell, job);
  return job;
}
