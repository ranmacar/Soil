import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { H3_RES, attachH3Overlay } from "./h3-overlay";
import { attachView3d } from "./view3d";
import "./style.css";

const LAST_KEY = "soil:last-loc";
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

type LngLat = { lng: number; lat: number };

const statusNode = document.getElementById("status");
if (!(statusNode instanceof HTMLElement)) {
  throw new Error("missing #status");
}
const statusEl: HTMLElement = statusNode;

const cellNode = document.getElementById("cell");
if (!(cellNode instanceof HTMLElement)) {
  throw new Error("missing #cell");
}
const cellEl: HTMLElement = cellNode;

function setCellLabel(id: string | null, reason: "zoom" | "here" | "select"): void {
  if (reason === "zoom" || !id) {
    cellEl.textContent = `Zoom in · H3 r${H3_RES}`;
    return;
  }
  cellEl.textContent = `${reason === "select" ? "cell" : "here"} · r${H3_RES} · ${id}`;
}

function setStatus(text: string, kind: "info" | "ok" | "err" = "info"): void {
  statusEl.hidden = text.length === 0;
  statusEl.dataset.kind = kind;
  statusEl.textContent = text;
}

function readLast(): LngLat | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "lng" in parsed &&
      "lat" in parsed &&
      typeof parsed.lng === "number" &&
      typeof parsed.lat === "number"
    ) {
      return { lng: parsed.lng, lat: parsed.lat };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveLast(coord: LngLat): void {
  localStorage.setItem(LAST_KEY, JSON.stringify(coord));
}

async function termuxLocation(): Promise<LngLat | null> {
  try {
    const res = await fetch("/api/location");
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (
      data &&
      typeof data === "object" &&
      "latitude" in data &&
      "longitude" in data &&
      typeof data.latitude === "number" &&
      typeof data.longitude === "number"
    ) {
      return { lng: data.longitude, lat: data.latitude };
    }
  } catch {
    /* ignore */
  }
  return null;
}

const last = readLast();

const map = new maplibregl.Map({
  container: "map",
  style: STYLE_URL,
  center: last ? [last.lng, last.lat] : [10, 51],
  zoom: last ? 14 : 3.2,
  attributionControl: { compact: true },
});

map.addControl(
  new maplibregl.NavigationControl({ visualizePitch: true }),
  "bottom-right",
);

const geolocate = new maplibregl.GeolocateControl({
  positionOptions: { enableHighAccuracy: true, timeout: 12_000 },
  fitBoundsOptions: { maxZoom: 16 },
  trackUserLocation: true,
  showUserLocation: true,
  showAccuracyCircle: true,
});
map.addControl(geolocate, "bottom-right");

const view3d = attachView3d();

const h3 = attachH3Overlay(map, {
  onFocus: setCellLabel,
  onSelect: (cell) => view3d.open(cell),
});
if (last) h3.setHere(last);

let usedFallback = false;

function flyTo(coord: LngLat, message: string): void {
  saveLast(coord);
  map.flyTo({ center: [coord.lng, coord.lat], zoom: 15, essential: true });
  setStatus(message, "ok");
}

async function fallbackLocation(): Promise<void> {
  if (usedFallback) return;
  usedFallback = true;
  const termux = await termuxLocation();
  if (termux) {
    flyTo(termux, "Location from Termux");
    h3.setHere(termux);
    new maplibregl.Marker({ color: "#8fa56a" })
      .setLngLat([termux.lng, termux.lat])
      .addTo(map);
    return;
  }
  setStatus("Location unavailable — pan the map", "err");
}

map.on("load", () => {
  setStatus("Finding your location…");
  geolocate.trigger();
});

geolocate.on("geolocate", (position: GeolocationPosition) => {
  const coord = {
    lng: position.coords.longitude,
    lat: position.coords.latitude,
  };
  saveLast(coord);
  h3.setHere(coord);
  setStatus("You're here", "ok");
});

geolocate.on("error", () => {
  void fallbackLocation();
});

window.visualViewport?.addEventListener("resize", () => map.resize());
window.addEventListener("orientationchange", () => map.resize());
