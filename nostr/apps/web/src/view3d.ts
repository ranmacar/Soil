import {
  cellToBoundary,
  cellToLatLng,
  getHexagonEdgeLengthAvg,
} from "h3-js";
import maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { lngLatToEnu } from "./geo";
import { H3_RES } from "./h3-overlay";
import { POD } from "./placements";
import { loadTerrainPatch, samplePatch } from "./terrain";

const CESIUM_BASE =
  "https://ajax.googleapis.com/ajax/libs/cesiumjs/1.105/Build/Cesium";
const HEX_SOURCE = "hex-focus";
const HEX_FILL = "hex-focus-fill";
const HEX_LINE = "hex-focus-line";

type Cartographic = { longitude: number; latitude: number; height: number };

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
    sampleHeight?: (pos: Cartographic) => number | undefined;
    sampleHeightMostDetailed?: (positions: Cartographic[]) => Promise<Cartographic[]>;
  };
};

type CesiumNS = {
  Viewer: new (container: HTMLElement, options: Record<string, unknown>) => CesiumViewer;
  Cesium3DTileset: new (options: Record<string, unknown>) => unknown;
  Cartesian3: {
    new (x: number, y: number, z: number): unknown;
    fromDegrees: (lng: number, lat: number, height?: number) => unknown;
    fromDegreesArray: (coordinates: number[]) => unknown;
    fromDegreesArrayHeights: (coordinates: number[]) => unknown;
  };
  Cartographic: {
    fromDegrees: (lng: number, lat: number, height?: number) => Cartographic;
  };
  HeightReference?: { CLAMP_TO_GROUND: unknown; CLAMP_TO_3D_TILE?: unknown };
  HeadingPitchRange: new (
    heading: number,
    pitch: number,
    range: number,
  ) => unknown;
  Math: { toRadians: (degrees: number) => number; toDegrees: (rad: number) => number };
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
        type: "fill-extrusion",
        source: HEX_SOURCE,
        paint: {
          "fill-extrusion-color": "#c6e27a",
          "fill-extrusion-height": 1.2,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.45,
        },
      },
      {
        id: HEX_LINE,
        type: "line",
        source: HEX_SOURCE,
        paint: { "line-color": "#e8eedc", "line-width": 2 },
      },
    ],
    terrain: { source: "terrain", exaggeration: 1 },
    sky: {},
  };
}

export function attachView3d(handlers: {
  onWalk?: (cell: string) => void;
  onClose?: () => void;
} = {}): { open(cell: string): void; close(): void; cell(): string | null } {
  const overlayNode = document.getElementById("view3d");
  const canvasNode = document.getElementById("view3d-canvas");
  const labelNode = document.getElementById("view3d-label");
  const errorNode = document.getElementById("view3d-error");
  const closeNode = document.getElementById("view3d-close");
  const walkNode = document.getElementById("view3d-walk");
  if (
    !(overlayNode instanceof HTMLElement) ||
    !(canvasNode instanceof HTMLElement) ||
    !(labelNode instanceof HTMLElement) ||
    !(errorNode instanceof HTMLElement) ||
    !(closeNode instanceof HTMLElement) ||
    !(walkNode instanceof HTMLElement)
  ) {
    throw new Error("missing 3D view markup");
  }
  const overlay: HTMLElement = overlayNode;
  const canvas: HTMLElement = canvasNode;
  const label: HTMLElement = labelNode;
  const errorEl: HTMLElement = errorNode;
  const closeBtn: HTMLElement = closeNode;
  const walkBtn: HTMLElement = walkNode;

  let viewer: CesiumViewer | null = null;
  let tilesetAdded = false;
  let cesium: CesiumNS | null = null;
  let mlMap: maplibregl.Map | null = null;
  let open = false;
  let currentCell: string | null = null;

  function setError(message: string | null): void {
    errorEl.hidden = !message;
    errorEl.textContent = message ?? "";
  }

  async function heightsForRing(
    cell: string,
    lng: number,
    lat: number,
    ring: number[][],
  ): Promise<{ center: number; ring: number[] }> {
    if (viewer && cesium && viewer.scene.sampleHeightMostDetailed) {
      const C = cesium;
      const samples = [
        C.Cartographic.fromDegrees(lng, lat),
        ...ring.map(([lo, la]) => C.Cartographic.fromDegrees(lo, la)),
      ];
      await viewer.scene.sampleHeightMostDetailed(samples);
      const center = samples[0]?.height;
      if (typeof center === "number" && Number.isFinite(center)) {
        return {
          center,
          ring: samples.slice(1).map((p) =>
            typeof p.height === "number" && Number.isFinite(p.height)
              ? p.height
              : center,
          ),
        };
      }
    }
    const patch = await loadTerrainPatch(cell);
    return {
      center: patch.originHeight,
      ring: ring.map(([lo, la]) => {
        const enu = lngLatToEnu(la, lo, lat, lng);
        return patch.originHeight + samplePatch(patch, enu.x, enu.z);
      }),
    };
  }

  async function lookAtHex(cell: string): Promise<void> {
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
      setPodFootprint(lat, lng);
      return;
    }
    if (!viewer || !cesium) return;
    const ring = cellToBoundary(cell, true);
    const range = getHexagonEdgeLengthAvg(H3_RES, "m") * 6;
    viewer.camera.lookAt(
      cesium.Cartesian3.fromDegrees(lng, lat, 0),
      new cesium.HeadingPitchRange(
        cesium.Math.toRadians(bearing),
        cesium.Math.toRadians(-38),
        range,
      ),
    );
    viewer.scene.requestRender();
    const sampled = await heightsForRing(cell, lng, lat, ring);
    const ground = sampled.center;
    viewer.camera.lookAt(
      cesium.Cartesian3.fromDegrees(lng, lat, ground),
      new cesium.HeadingPitchRange(
        cesium.Math.toRadians(bearing),
        cesium.Math.toRadians(-38),
        range,
      ),
    );
    viewer.entities.removeAll();
    const withH: number[] = [];
    ring.forEach(([ringLng, ringLat], i) => {
      withH.push(ringLng, ringLat, (sampled.ring[i] ?? ground) + 0.4);
    });
    const first = ring[0];
    if (first) withH.push(first[0], first[1], (sampled.ring[0] ?? ground) + 0.4);
    const draped = cesium.Cartesian3.fromDegreesArrayHeights(withH);
    viewer.entities.add({
      polyline: {
        positions: draped,
        width: 4,
        material: cesium.Color.fromCssColorString("#c6e27a"),
      },
    });
    viewer.entities.add({
      polygon: {
        hierarchy: draped,
        perPositionHeight: true,
        material: cesium.Color.fromCssColorString("#c6e27a").withAlpha(0.28),
      },
    });
    viewer.entities.add({
      position: cesium.Cartesian3.fromDegrees(lng, lat, ground + POD.height / 2),
      box: {
        dimensions: new cesium.Cartesian3(POD.width, POD.depth, POD.height),
        material: cesium.Color.fromCssColorString("#8fa56a").withAlpha(0.92),
        outline: true,
        outlineColor: cesium.Color.fromCssColorString("#e8eedc"),
      },
    });
    viewer.scene.requestRender();
  }

  function setPodFootprint(lat: number, lng: number): void {
    if (!mlMap) return;
    const dLat = POD.width / 2 / 111_111;
    const dLng = POD.depth / 2 / (111_111 * Math.cos((lat * Math.PI) / 180));
    const ring = [
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ];
    const data = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: { h: POD.height },
          geometry: { type: "Polygon" as const, coordinates: [ring] },
        },
      ],
    };
    const source = mlMap.getSource("pod");
    if (source && source.type === "geojson") {
      (source as GeoJSONSource).setData(data);
      return;
    }
    mlMap.addSource("pod", { type: "geojson", data });
    mlMap.addLayer({
      id: "pod-ex",
      type: "fill-extrusion",
      source: "pod",
      paint: {
        "fill-extrusion-color": "#8fa56a",
        "fill-extrusion-height": POD.height,
        "fill-extrusion-opacity": 0.9,
      },
    });
  }

  function ensureMapLibre(cell: string): void {
    if (mlMap) {
      void lookAtHex(cell);
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
      void lookAtHex(cell);
    });
  }

  async function ensureGoogle(cell: string): Promise<void> {
    const key = apiKey();
    if (!key) throw new Error("missing key");
    const probe = await fetch(
      `https://tile.googleapis.com/v1/3dtiles/root.json?key=${encodeURIComponent(key)}`,
    );
    if (!probe.ok) {
      throw new Error("Google 3D Tiles key was rejected");
    }
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
    await lookAtHex(cell);
  }

  function hide(): void {
    if (!open) return;
    open = false;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    if (viewer) viewer.useDefaultRenderLoop = false;
  }

  function close(): void {
    hide();
    handlers.onClose?.();
  }

  async function openCell(cell: string): Promise<void> {
    currentCell = cell;
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
  walkBtn.addEventListener("click", () => {
    if (!currentCell) return;
    hide();
    handlers.onWalk?.(currentCell);
  });

  return {
    open: (cell) => void openCell(cell),
    close,
    cell: () => currentCell,
  };
}
