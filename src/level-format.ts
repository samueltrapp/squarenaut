import { getTileType, type Cell, type TileInstance } from "./tiles";

export interface LevelDefinition {
  grid: {
    width: number;
    height: number;
  };
  tiles: TileInstance[];
  start: Cell;
  goal: Cell;
  par?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertKeys(value: Record<string, unknown>, allowed: string[], label: string): void {
  const unexpectedKey = Object.keys(value).find((key) => !allowed.includes(key));
  if (unexpectedKey) {
    throw new Error(`${label} contains an unsupported field: ${unexpectedKey}`);
  }
}

function readCell(
  value: unknown,
  label: string,
  width: number,
  height: number,
  allowedFields = ["x", "y"],
): Cell {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a cell object`);
  }
  assertKeys(value, allowedFields, label);
  const { x, y } = value;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= width ||
    y < 0 ||
    y >= height
  ) {
    throw new Error(`${label} must be an integer cell inside the grid`);
  }
  return { x, y };
}

export function loadLevel(value: unknown): LevelDefinition {
  if (!isRecord(value)) {
    throw new Error("Level must be an object");
  }
  assertKeys(value, ["grid", "tiles", "start", "goal", "par"], "Level");
  if (!isRecord(value.grid)) {
    throw new Error("Level must contain a grid object");
  }
  assertKeys(value.grid, ["width", "height"], "Grid");

  const { width, height } = value.grid;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    width > 100 ||
    height < 1 ||
    height > 100
  ) {
    throw new Error("Grid width and height must be integers between 1 and 100");
  }

  const start = readCell(value.start, "Start", width, height);
  const goal = readCell(value.goal, "Goal", width, height);
  if (start.x === goal.x && start.y === goal.y) {
    throw new Error("Start and goal must be different cells");
  }
  if (
    value.par !== undefined &&
    (typeof value.par !== "number" || !Number.isInteger(value.par) || value.par < 1)
  ) {
    throw new Error("Par must be a positive integer");
  }
  if (!Array.isArray(value.tiles)) {
    throw new Error("Level tiles must be an array");
  }

  const occupiedCells = new Set<string>();
  const tiles = value.tiles.map((tile, index): TileInstance => {
    if (!isRecord(tile)) {
      throw new Error(`Tile ${index + 1} must be an object`);
    }
    assertKeys(tile, ["x", "y", "typeId"], `Tile ${index + 1}`);
    const cell = readCell(tile, `Tile ${index + 1}`, width, height, ["x", "y", "typeId"]);
    if (typeof tile.typeId !== "string") {
      throw new Error(`Tile ${index + 1} must have a typeId`);
    }
    const type = getTileType(tile.typeId);
    if (type.id === "air" || type.id === "goal") {
      throw new Error(`Tile ${index + 1} must use a placeable tile type`);
    }
    const key = `${cell.x},${cell.y}`;
    if (occupiedCells.has(key)) {
      throw new Error(`More than one tile occupies cell ${key}`);
    }
    occupiedCells.add(key);
    return { ...cell, typeId: type.id };
  });

  return {
    grid: { width, height },
    tiles,
    start,
    goal,
    ...(value.par === undefined ? {} : { par: value.par }),
  };
}

export function serializeLevel(level: LevelDefinition): LevelDefinition {
  return {
    grid: { ...level.grid },
    tiles: level.tiles.map((tile) => ({ ...tile })),
    start: { ...level.start },
    goal: { ...level.goal },
    ...(level.par === undefined ? {} : { par: level.par }),
  };
}
