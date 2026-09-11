import { hexRingEnu } from "./geo";
import { POD } from "./placements";

type WalkHandle = {
  open(cell: string): void;
  close(): void;
};

export function attachWalk(handlers: { onLook?: () => void; onMap?: () => void } = {}): WalkHandle {
  const overlayNode = document.getElementById("walk");
  const canvasNode = document.getElementById("walk-canvas");
  const labelNode = document.getElementById("walk-label");
  const lookBtn = document.getElementById("walk-look");
  const mapBtn = document.getElementById("walk-map");
  const fwdBtn = document.getElementById("walk-fwd");
  if (
    !(overlayNode instanceof HTMLElement) ||
    !(canvasNode instanceof HTMLCanvasElement) ||
    !(labelNode instanceof HTMLElement) ||
    !(lookBtn instanceof HTMLElement) ||
    !(mapBtn instanceof HTMLElement) ||
    !(fwdBtn instanceof HTMLElement)
  ) {
    throw new Error("missing walk markup");
  }
  const overlay: HTMLElement = overlayNode;
  const canvas: HTMLCanvasElement = canvasNode;
  const label: HTMLElement = labelNode;
  const look: HTMLElement = lookBtn;
  const map: HTMLElement = mapBtn;
  const fwd: HTMLElement = fwdBtn;

  let engine: {
    stopRenderLoop: () => void;
    dispose: () => void;
    resize: () => void;
    getDeltaTime: () => number;
    runRenderLoop: (fn: () => void) => void;
  } | null = null;
  let sceneDispose: (() => void) | null = null;
  let open = false;
  let fwdHeld = false;

  function close(): void {
    if (!open) return;
    open = false;
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    sceneDispose?.();
    sceneDispose = null;
    engine?.stopRenderLoop();
    engine?.dispose();
    engine = null;
  }

  async function openCell(cell: string): Promise<void> {
    open = true;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    label.textContent = `Walk · ${cell}`;

    const {
      Engine,
      Scene,
      UniversalCamera,
      HemisphericLight,
      PointLight,
      Vector3,
      Color3,
      Color4,
      MeshBuilder,
      StandardMaterial,
    } = await import("@babylonjs/core");

    if (!open) return;
    sceneDispose?.();
    engine?.dispose();

    const eng = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      adaptToDeviceRatio: true,
    });
    engine = eng;
    const scene = new Scene(eng);
    scene.gravity = new Vector3(0, -0.35, 0);
    scene.collisionsEnabled = true;
    scene.clearColor = new Color4(0.45, 0.62, 0.82, 1);

    const light = new HemisphericLight("sky", new Vector3(0.3, 1, 0.2), scene);
    light.intensity = 0.85;
    const interior = new PointLight("pod-light", new Vector3(0, 2.4, 0), scene);
    interior.intensity = 0.55;
    interior.diffuse = new Color3(1, 0.95, 0.8);

    const groundMat = new StandardMaterial("ground", scene);
    groundMat.diffuseColor = new Color3(0.45, 0.52, 0.38);
    groundMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const ring = hexRingEnu(cell);
    const ground = MeshBuilder.CreateGround("ground", { width: 180, height: 180 }, scene);
    ground.material = groundMat;
    ground.checkCollisions = true;
    const outline = ring.map((p) => new Vector3(p.x, 0.08, p.z));
    if (outline[0]) outline.push(outline[0]);
    MeshBuilder.CreateLines("hex", { points: outline }, scene);

    const wallMat = new StandardMaterial("wall", scene);
    wallMat.diffuseColor = new Color3(0.72, 0.78, 0.62);
    const roofMat = new StandardMaterial("roof", scene);
    roofMat.diffuseColor = new Color3(0.35, 0.42, 0.28);

    const w = POD.width;
    const d = POD.depth;
    const h = POD.height;
    const t = POD.wall;
    const doorW = POD.doorWidth;
    const doorH = POD.doorHeight;

    function wall(
      name: string,
      width: number,
      height: number,
      depth: number,
      x: number,
      y: number,
      z: number,
    ): void {
      const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
      mesh.position.set(x, y, z);
      mesh.material = wallMat;
      mesh.checkCollisions = true;
    }

    // South, east, west — solid. North wall split for a door.
    wall("south", w, h, t, 0, h / 2, -d / 2 + t / 2);
    wall("east", t, h, d, w / 2 - t / 2, h / 2, 0);
    wall("west", t, h, d, -w / 2 + t / 2, h / 2, 0);
    const side = (w - doorW) / 2;
    wall(
      "north-l",
      side,
      h,
      t,
      -w / 2 + side / 2,
      h / 2,
      d / 2 - t / 2,
    );
    wall(
      "north-r",
      side,
      h,
      t,
      w / 2 - side / 2,
      h / 2,
      d / 2 - t / 2,
    );
    wall(
      "lintel",
      doorW,
      h - doorH,
      t,
      0,
      doorH + (h - doorH) / 2,
      d / 2 - t / 2,
    );

    const roof = MeshBuilder.CreateBox("roof", { width: w, height: t, depth: d }, scene);
    roof.position.set(0, h + t / 2, 0);
    roof.material = roofMat;
    roof.checkCollisions = true;

    const camera = new UniversalCamera(
      "eye",
      new Vector3(0, 1.7, d / 2 + 4),
      scene,
    );
    camera.setTarget(new Vector3(0, 1.5, 0));
    camera.attachControl(canvas, true);
    camera.speed = 0.18;
    camera.angularSensibility = 4000;
    camera.checkCollisions = true;
    camera.applyGravity = true;
    camera.ellipsoid = new Vector3(0.32, 0.84, 0.32);
    camera.minZ = 0.08;
    camera.keysUp = [87, 38];
    camera.keysDown = [83, 40];
    camera.keysLeft = [65, 37];
    camera.keysRight = [68, 39];

    scene.registerBeforeRender(() => {
      if (!fwdHeld) return;
      const dt = eng.getDeltaTime() / 1000;
      const dir = camera.getDirection(Vector3.Forward());
      dir.y = 0;
      if (dir.lengthSquared() < 1e-6) return;
      dir.normalize();
      camera.cameraDirection.addInPlace(dir.scale(2.4 * dt));
    });

    const loop = (): void => {
      scene.render();
    };
    eng.runRenderLoop(loop);
    const onResize = (): void => eng.resize();
    window.addEventListener("resize", onResize);
    sceneDispose = () => {
      window.removeEventListener("resize", onResize);
      scene.dispose();
    };
  }

  look.addEventListener("click", () => {
    close();
    handlers.onLook?.();
  });
  map.addEventListener("click", () => {
    close();
    handlers.onMap?.();
  });
  const hold = (on: boolean) => () => {
    fwdHeld = on;
  };
  fwd.addEventListener("pointerdown", hold(true));
  fwd.addEventListener("pointerup", hold(false));
  fwd.addEventListener("pointerleave", hold(false));
  fwd.addEventListener("pointercancel", hold(false));

  return { open: (cell) => void openCell(cell), close };
}
