import {
  cellToBoundary,
  getHexagonEdgeLengthAvg,
  greatCircleDistance,
  gridDisk,
  latLngToCell,
} from "h3-js";
import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";

export const H3_RES = 10;

const SOURCE = "h3-cells";
const FILL = "h3-fill";
const LINE = "h3-line";
const MAX_RING = 14;

type Role = "here" | "selected" | "idle";

type OverlayHandlers = {
  onFocus?: (cell: string | null, reason: "zoom" | "here" | "select") => void;
  onSelect?: (cell: string) => void;
};

export type H3Overlay = {
  setHere(coord: { lng: number; lat: number } | null): void;
  refresh(): void;
};

function cellFeature(id: string, role: Role) {
  return {
    type: "Feature" as const,
    properties: { id, role },
    geometry: {
      type: "Polygon" as const,
      coordinates: [cellToBoundary(id, true)],
    },
  };
}

function roleFor(id: string, hereId: string | null, selectedId: string | null): Role {
  if (id === hereId) return "here";
  if (id === selectedId) return "selected";
  return "idle";
}

export function attachH3Overlay(map: MapLibreMap, handlers: OverlayHandlers = {}): H3Overlay {
  let hereId: string | null = null;
  let selectedId: string | null = null;
  let mounted = false;

  function focusCell(reason: "zoom" | "here" | "select"): void {
    handlers.onFocus?.(selectedId ?? hereId, reason);
  }

  function cellsToDraw(): string[] {
    if (map.getZoom() < 13) return [];
    const center = map.getCenter();
    const origin = latLngToCell(center.lat, center.lng, H3_RES);
    const ne = map.getBounds().getNorthEast();
    const radiusM = greatCircleDistance(
      [center.lat, center.lng],
      [ne.lat, ne.lng],
      "m",
    );
    const centerDist = getHexagonEdgeLengthAvg(H3_RES, "m") * Math.sqrt(3);
    const k = Math.min(MAX_RING, Math.max(1, Math.ceil(radiusM / centerDist) + 1));
    const ids = new Set(gridDisk(origin, k));
    if (hereId) ids.add(hereId);
    if (selectedId) ids.add(selectedId);
    return [...ids];
  }

  function render(): void {
    const source = map.getSource(SOURCE);
    if (!source || source.type !== "geojson") return;
    const zoomedOut = map.getZoom() < 13;
    const ids = cellsToDraw();
    (source as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: ids.map((id) => cellFeature(id, roleFor(id, hereId, selectedId))),
    });
    if (zoomedOut) {
      handlers.onFocus?.(null, "zoom");
      return;
    }
    focusCell(selectedId ? "select" : "here");
  }

  function onClick(ev: MapMouseEvent): void {
    const feature = map.queryRenderedFeatures(ev.point, { layers: [FILL] })[0];
    const id = feature?.properties?.id;
    if (typeof id !== "string") return;
    selectedId = id;
    render();
    handlers.onSelect?.(id);
  }

  function mount(): void {
    if (mounted) return;
    mounted = true;
    map.addSource(SOURCE, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: FILL,
      type: "fill",
      source: SOURCE,
      paint: {
        "fill-color": [
          "match",
          ["get", "role"],
          "here",
          "#c6e27a",
          "selected",
          "#e8eedc",
          "#8fa56a",
        ],
        "fill-opacity": [
          "match",
          ["get", "role"],
          "here",
          0.38,
          "selected",
          0.28,
          0.1,
        ],
      },
    });
    map.addLayer({
      id: LINE,
      type: "line",
      source: SOURCE,
      paint: {
        "line-color": [
          "match",
          ["get", "role"],
          "here",
          "#e8eedc",
          "selected",
          "#c6e27a",
          "#5d6e45",
        ],
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          13,
          0.6,
          16,
          1.6,
        ],
        "line-opacity": 0.85,
      },
    });
    map.on("moveend", render);
    map.on("click", FILL, onClick);
    map.on("mouseenter", FILL, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", FILL, () => {
      map.getCanvas().style.cursor = "";
    });
    render();
  }

  if (map.loaded()) mount();
  else map.once("load", mount);

  return {
    setHere(coord) {
      hereId = coord ? latLngToCell(coord.lat, coord.lng, H3_RES) : null;
      if (!selectedId) selectedId = hereId;
      render();
    },
    refresh: render,
  };
}
