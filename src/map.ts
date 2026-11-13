import {
  fitGridToViewport,
  GRID_HEIGHT,
  GRID_TOP,
  GRID_WIDTH,
  defaultLevel,
  levelTiles,
  startCell,
  TILE_SIZE,
} from "./level";
import {
  airType,
  createTileRegions,
  getTileType,
  type Cell,
  type TileInstance,
  type TileProperties,
  type TileRegion,
} from "./tiles";
import type { LevelDefinition } from "./level-format";

export interface GameMap {
  gridWidth: number;
  gridHeight: number;
  gridPixelWidth: number;
  gridPixelHeight: number;
  viewport: ReturnType<typeof fitGridToViewport>;
  tiles: TileInstance[];
  startCell: Cell;
  regions: TileRegion[];
  regionByCell: Map<string, TileRegion>;
  airValues: TileProperties;
}

export function createMap(
  canvasWidth: number,
  canvasHeight: number,
  level: LevelDefinition = defaultLevel,
): GameMap {
  const tiles = [...level.tiles, { ...level.goal, typeId: "goal" }];
  const { regions, regionByCell } = createTileRegions(tiles);
  const airValues: TileProperties = Object.fromEntries(
    Object.entries(airType.properties).map(([key, property]) => [key, property.default]),
  );

  return {
    gridWidth: level.grid.width,
    gridHeight: level.grid.height,
    gridPixelWidth: level.grid.width * TILE_SIZE,
    gridPixelHeight: GRID_TOP + level.grid.height * TILE_SIZE,
    viewport: fitGridToViewport(canvasWidth, canvasHeight, level.grid.width, level.grid.height),
    tiles,
    startCell: level.start,
    regions,
    regionByCell,
    airValues,
  };
}

export function getCellRect(cell: Cell): { x: number; y: number; size: number } {
  return {
    x: cell.x * TILE_SIZE,
    y: GRID_TOP + cell.y * TILE_SIZE,
    size: TILE_SIZE,
  };
}

function drawTile(context: CanvasRenderingContext2D, tile: TileInstance): void {
  const type = getTileType(tile.typeId);
  const { x, y, size } = getCellRect(tile);

  if (tile.typeId === "platform") {
    context.fillStyle = type.color;
    context.fillRect(x, y, size, size);
    context.fillStyle = "#b7c3d0";
    context.fillRect(x, y, size, 5);
    context.fillStyle = "rgb(25 34 44 / 30%)";
    context.fillRect(x, y + size - 5, size, 5);
    return;
  }

  if (tile.typeId === "water") {
    context.fillStyle = `${type.color}b8`;
    context.fillRect(x + 2, y + 2, size - 4, size - 4);
    context.strokeStyle = "#86d9f3";
    context.lineWidth = 2;
    for (const waveY of [y + 16, y + 30]) {
      context.beginPath();
      context.moveTo(x + 9, waveY);
      context.quadraticCurveTo(x + 17, waveY - 5, x + 24, waveY);
      context.quadraticCurveTo(x + 32, waveY + 5, x + 39, waveY);
      context.stroke();
    }
    return;
  }

  if (tile.typeId === "goal") {
    context.fillStyle = "#245b43";
    context.fillRect(x + 4, y + 4, size - 8, size - 8);
    context.strokeStyle = type.color;
    context.lineWidth = 3;
    context.strokeRect(x + 7, y + 7, size - 14, size - 14);
    context.fillStyle = type.color;
    context.beginPath();
    context.arc(x + size / 2, y + size / 2, 8, 0, Math.PI * 2);
    context.fill();
    return;
  }

  if (tile.typeId === "hazard") {
    context.fillStyle = "#542e38";
    context.fillRect(x + 4, y + 4, size - 8, size - 8);
    context.fillStyle = type.color;
    context.beginPath();
    context.moveTo(x + 7, y + size - 8);
    context.lineTo(x + size / 2, y + 7);
    context.lineTo(x + size - 7, y + size - 8);
    context.closePath();
    context.fill();
  }
}

function drawStartMarker(context: CanvasRenderingContext2D, start: Cell): void {
  const x = (start.x + 0.5) * TILE_SIZE;
  const y = GRID_TOP + (start.y + 1) * TILE_SIZE - 16;
  context.strokeStyle = "rgb(219 234 247 / 48%)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x - 19, y + 1);
  context.lineTo(x - 19, y - 28);
  context.stroke();
  context.fillStyle = "#dbeaf7";
  context.beginPath();
  context.moveTo(x - 18, y - 27);
  context.lineTo(x - 5, y - 22);
  context.lineTo(x - 18, y - 17);
  context.closePath();
  context.fill();
}

export function drawMap(
  context: CanvasRenderingContext2D,
  map: GameMap,
  selectedRegion: TileRegion | undefined,
): void {
  context.fillStyle = airType.color;
  context.fillRect(0, GRID_TOP, map.gridPixelWidth, map.gridHeight * TILE_SIZE);

  for (const tile of map.tiles) {
    drawTile(context, tile);
  }

  drawStartMarker(context, map.startCell);

  context.strokeStyle = "rgb(183 201 219 / 10%)";
  context.lineWidth = 1;
  for (let x = 0; x <= map.gridWidth; x += 1) {
    const gridX = x * TILE_SIZE + 0.5;
    context.beginPath();
    context.moveTo(gridX, GRID_TOP);
    context.lineTo(gridX, GRID_TOP + GRID_HEIGHT * TILE_SIZE);
    context.stroke();
  }
  for (let y = 0; y <= map.gridHeight; y += 1) {
    const gridY = GRID_TOP + y * TILE_SIZE + 0.5;
    context.beginPath();
    context.moveTo(0, gridY);
    context.lineTo(map.gridWidth * TILE_SIZE, gridY);
    context.stroke();
  }

  if (selectedRegion) {
    context.strokeStyle = "#9de7ba";
    context.lineWidth = 2;
    for (const cell of selectedRegion.cells) {
      const rect = getCellRect(cell);
      context.strokeRect(rect.x + 2, rect.y + 2, rect.size - 4, rect.size - 4);
    }
  }
}

export { GRID_HEIGHT, GRID_TOP, GRID_WIDTH, levelTiles, startCell, TILE_SIZE };
