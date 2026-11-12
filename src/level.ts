import type { Cell, TileInstance } from "./tiles";

export const GRID_WIDTH = 30;
export const GRID_HEIGHT = 20;
export const TILE_SIZE = 48;
export const GRID_TOP = 6;

export const startCell: Cell = { x: 1, y: 1 };

export function fitGridToViewport(
  viewportWidth: number,
  viewportHeight: number,
  gridWidth = GRID_WIDTH,
  gridHeight = GRID_HEIGHT,
): { scale: number; offsetX: number; offsetY: number } {
  const gridPixelWidth = gridWidth * TILE_SIZE;
  const gridPixelHeight = GRID_TOP + gridHeight * TILE_SIZE;
  const scale = Math.min(viewportWidth / gridPixelWidth, viewportHeight / gridPixelHeight);

  return {
    scale,
    offsetX: (viewportWidth - gridPixelWidth * scale) / 2,
    offsetY: (viewportHeight - gridPixelHeight * scale) / 2,
  };
}

function platformRow(startX: number, endX: number, y: number): TileInstance[] {
  return Array.from({ length: endX - startX + 1 }, (_, index) => ({
    x: startX + index,
    y,
    typeId: "platform",
  }));
}

export const levelTiles: TileInstance[] = [
  ...platformRow(0, 6, 3),
  ...platformRow(8, 19, 10),
  ...platformRow(2, 4, 5),
  ...platformRow(6, 8, 5),
  ...platformRow(11, 13, 6),
  { x: 9, y: 9, typeId: "water" },
  { x: 10, y: 5, typeId: "hazard" },
  { x: 17, y: 9, typeId: "goal" },
];
