import {
  cellToBoundary,
  cellToLatLng,
  getHexagonEdgeLengthAvg,
} from "h3-js";
import maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { H3_RES } from "./h3-overlay";

const CESIUM_BASE =
  "https://ajax.googleapis.com/ajax/libs/cesiumjs/1.105/Build/Cesium";
const HEX_SOURCE = "hex-focus";
const HEX_FILL = "hex-focus-fill";
const HEX_LINE = "hex-focus-line";

type CesiumViewer = {
  resize: () => void;
  destroy: () => void;
  useDefaultRenderLoop: boolean;
  camera: {
    lookAt: (target: unknown, offset: unknown) => void;
  };
  entities: {
    removeAll: () => void;
    add: (entity: unknown) => unknown;
  };
  scene: {
    primitives: { add: (primitive: unknown) => unknown };
    requestRender: () => void;
    globe: { show: boolean };
  };
};

type CesiumNS = {
  Viewer: new (container: HTMLElement, options: Record<string, unknown>) => CesiumViewer;
  Cesium3DTileset: new (options: Record<string, unknown>) => unknown;
  Cartesian3: {
    fromDegrees: (lng: number, lat: number, height?: number) => unknown;
    fromDegreesArray: (coordinates: number[]) => unknown;
  };
  HeadingPitchRange: new (
    heading: number,
    pitch: number,
    range: number,
  ) => unknown;
  Math: { toRadians: (degrees: number) => number };
  Color: {
    fromCssColorString: (css: string) => { withAlpha: (alpha: number) => unknown };
  };
  ClassificationType: { CESIUM_3D_TILE: unknown };
};

declare global {
  interface Window {
    Cesium?: CesiumNS;
  }
}

function apiKey(): string | null {
  const env =
    import.meta.env.VITE_GOOGLE_TILES_API_KEY ??
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (typeof env === "string" && env.trim()) return env.trim();
  const params = new URLSearchParams(window.location.search);
  const query = params.get("tilesKey") ?? params.get("key");
  if (query && query.trim()) return query.trim();
  return null;
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadCesium(): Promise<CesiumNS> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  if (!document.querySelector(`link[href="${CESIUM_BASE}/Widgets/widgets.css"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${CESIUM_BASE}/Widgets/widgets.css`;
    document.head.appendChild(link);
  }
  return loadScript(`${CESIUM_BASE}/Cesium.js`).then(() => {
    if (!window.Cesium) throw new Error("Cesium failed to initialize");
    return window.Cesium;
  });
}

function hexFeature(cell: string) {
  return {
    type: "Feature" as const,
    properties: { id: cell },
    geometry: {
      type: "Polygon" as const,
      coordinates: [cellToBoundary(cell, true)],
    },
  };
}

function terrainStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Tiles © Esri",
      },
      terrain: {
        type: "raster-dem",
        tiles: [
          "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
        ],
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 15,
      },
      [HEX_SOURCE]: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    layers: [
      { id: "satellite", type: "raster", source: "satellite" },
      {
        id: "hills",
        type: "hillshade",
        source: "terrain",
        paint: { "hillshade-exaggeration": 0.45 },
      },
      {
        id: HEX_FILL,
        type: "fill",
        source: HEX_SOURCE,
        paint: { "fill-color": "#c6e27a", "fill-opacity": 0.28 },
      },
      {
        id: HEX_LINE,
        type: "line",
        source: HEX_SOURCE,
        paint: { "line-color": "#e8eedc", "line-width": 2 },
      },
    ],
    terrain: { source: "terrain", exaggeration: 1.35 },
    sky: {},
  };
}

export function attachView3d(): { open(cell: string): void; close(): void } {
  const overlayNode = document.getElementById("view3d");
  const canvasNode = document.getElementById("view3d-canvas");
  const labelNode = document.getElementById("view3d-label");
  const errorNode = document.getElementById("view3d-error");
  const closeNode = document.getElementById("view3d-close");
  if (
    !(overlayNode instanceof HTMLElement) ||
    !(canvasNode instanceof HTMLElement) ||
    !(labelNode instanceof HTMLElement) ||
    !(errorNode instanceof HTMLElement) ||
    !(closeNode instanceof HTMLElement)
  ) {
    throw new Error("missing 3D view markup");
  }
  const overlay: HTMLElement = overlayNode;
  const canvas: HTMLElement = canvasNode;
  const label: HTMLElement = labelNode;
  const errorEl: HTMLElement = errorNode;
  const closeBtn: HTMLElement = closeNode;

  let viewer: CesiumViewer | null = null;
  let tilesetAdded = false;
  let cesium: CesiumNS | null = null;
  let mlMap: maplibregl.Map | null = null;
  let open = false;

  function setError(message: string | null): void {
    errorEl.hidden = !message;
    errorEl.textContent = message ?? "";
  }

  function lookAtHex(cell: string): void {
    const [lat, lng] = cellToLatLng(cell);
    const zoom = 16.2;
    const pitch = 68;
    const bearing = 18;
    if (mlMap) {
      const source = mlMap.getSource(HEX_SOURCE);
      if (source && source.type === "geojson") {
        (source as GeoJSONSource).setData({
          type: "FeatureCollection",
          features: [hexFeature(cell)],
        });
      }
      mlMap.resize();
      mlMap.flyTo({
        center: [lng, lat],
        zoom,
        pitch,
        bearing,
        essential: true,
        duration: 900,
      });
      return;
    }
    if (!viewer || !cesium) return;
    const target = cesium.Cartesian3.fromDegrees(lng, lat, 0);
    const range = getHexagonEdgeLengthAvg(H3_RES, "m") * 6;
    viewer.camera.lookAt(
      target,
      new cesium.HeadingPitchRange(
        cesium.Math.toRadians(bearing),
        cesium.Math.toRadians(-38),
        range,
      ),
    );
    viewer.entities.removeAll();
    const ring = cellToBoundary(cell, true);
    const degrees: number[] = [];
    for (const [ringLng, ringLat] of ring) {
      degrees.push(ringLng, ringLat);
    }
    const hierarchy = cesium.Cartesian3.fromDegreesArray(degrees);
    viewer.entities.add({
      polyline: {
        positions: hierarchy,
        width: 3,
        material: cesium.Color.fromCssColorString("#c6e27a"),
      },
    });
    viewer.entities.add({
      polygon: {
        hierarchy,
        material: cesium.Color.fromCssColorString("#c6e27a").withAlpha(0.22),
        classificationType: cesium.ClassificationType.CESIUM_3D_TILE,
      },
    });
    viewer.scene.requestRender();
  }

  function ensureMapLibre(cell: string): void {
    if (mlMap) {
      lookAtHex(cell);
      return;
    }
    const [lat, lng] = cellToLatLng(cell);
    mlMap = new maplibregl.Map({
      container: canvas,
      style: terrainStyle(),
      center: [lng, lat],
      zoom: 16.2,
      pitch: 68,
      bearing: 18,
      maxPitch: 85,
      attributionControl: { compact: true },
    });
    mlMap.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "bottom-right",
    );
    mlMap.on("load", () => {
      lookAtHex(cell);
    });
  }

  async function ensureGoogle(cell: string): Promise<void> {
    const key = apiKey();
    if (!key) throw new Error("missing key");
    setError(null);
    label.textContent = "Loading photorealistic tiles…";
    cesium = await loadCesium();
    if (!viewer) {
      viewer = new cesium.Viewer(canvas, {
        animation: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        navigationHelpButton: false,
        imageryProvider: false,
        requestRenderMode: true,
        creditContainer: document.getElementById("view3d-credits") ?? undefined,
      });
      viewer.scene.globe.show = false;
    }
    if (!tilesetAdded) {
      viewer.scene.primitives.add(
        new cesium.Cesium3DTileset({
          url: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`,
          showCreditsOnScreen: true,
        }),
      );
      tilesetAdded = true;
    }
    viewer.useDefaultRenderLoop = true;
    viewer.resize();
    lookAtHex(cell);
  }

  function close(): void {
    if (!open) return;
    open = false;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    if (viewer) viewer.useDefaultRenderLoop = false;
  }

  async function openCell(cell: string): Promise<void> {
    open = true;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    label.textContent = `H3 r${H3_RES} · ${cell}`;
    setError(null);
    try {
      if (apiKey() && !mlMap) {
        await ensureGoogle(cell);
      } else {
        ensureMapLibre(cell);
      }
      if (!open) return;
      label.textContent = `H3 r${H3_RES} · ${cell}`;
    } catch (err) {
      ensureMapLibre(cell);
      setError(
        err instanceof Error
          ? `${err.message} — showing 3D terrain instead.`
          : "Showing 3D terrain instead.",
      );
    }
  }

  closeBtn.addEventListener("click", () => close());
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return { open: (cell) => void openCell(cell), close };
}
