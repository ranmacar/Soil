/** Shared architecture placed on a cell. Look and Walk both read this. */

export type Placement = {
  id: string;
  cell: string;
  kind: "pod";
  enu: [e: number, n: number, u: number];
  yaw: number;
};

export const POD = {
  width: 6,
  depth: 6,
  height: 3.2,
  wall: 0.2,
  doorWidth: 1.2,
  doorHeight: 2.2,
} as const;

export function placementsFor(cell: string): Placement[] {
  return [
    {
      id: `${cell}:pod`,
      cell,
      kind: "pod",
      enu: [0, 0, 0],
      yaw: 0,
    },
  ];
}
