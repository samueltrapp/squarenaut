import defaultLevelData from "../levels/default.json";
import { loadLevel, type LevelDefinition } from "./level-format";
import type { Cell, TileInstance } from "./tiles";

export const defaultLevel: LevelDefinition = loadLevel(defaultLevelData);
export const GRID_WIDTH = defaultLevel.grid.width;
export const GRID_HEIGHT = defaultLevel.grid.height;
export const TILE_SIZE = 48;
export const GRID_TOP = 6;

export const startCell: Cell = defaultLevel.start;

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

export const levelTiles: TileInstance[] = [
  ...defaultLevel.tiles,
  { ...defaultLevel.goal, typeId: "goal" },
];
