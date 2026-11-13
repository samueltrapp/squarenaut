export interface Cell {
  x: number;
  y: number;
}

export interface TileProperty {
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

export type TileProperties = Record<string, number>;
export type CollisionNormal = { x: -1 | 0 | 1; y: -1 | 0 | 1 };
export type TileOutcome = "goal" | "hazard";

export interface TileType {
  id: string;
  label: string;
  color: string;
  properties: Record<string, TileProperty>;
  solid?: boolean;
  onCollision?: (
    velocity: Cell,
    normal: CollisionNormal,
    properties: Readonly<TileProperties>,
    deltaSeconds: number,
  ) => Cell;
  onOverlap?: (properties: Readonly<TileProperties>) => TileOutcome | undefined;
}

export interface TileInstance extends Cell {
  typeId: string;
}

export interface TileRegion {
  typeId: string;
  cells: Cell[];
  values: TileProperties;
}

const platformCollision: NonNullable<TileType["onCollision"]> = (
  velocity,
  normal,
  properties,
  deltaSeconds,
) => {
  const normalSpeed = velocity.x * normal.x + velocity.y * normal.y;
  const reflected = { x: velocity.x, y: velocity.y };

  if (normalSpeed < 0) {
    const bounce = Math.sqrt(properties.bounciness);
    reflected.x -= (1 + bounce) * normalSpeed * normal.x;
    reflected.y -= (1 + bounce) * normalSpeed * normal.y;
  }

  if (normal.y !== 0) {
    reflected.x += properties.acceleration * deltaSeconds;
  } else {
    reflected.y += properties.acceleration * deltaSeconds;
  }
  return reflected;
};

const definitions: TileType[] = [
  {
    id: "air",
    label: "Air",
    color: "#202936",
    properties: {
      gravity: {
        label: "Gravity",
        min: 0,
        max: 900,
        step: 10,
        default: 450,
      },
      launchVelocity: {
        label: "Launch velocity",
        min: 100,
        max: 1200,
        step: 25,
        default: 600,
      },
    },
  },
  {
    id: "platform",
    label: "Platform",
    color: "#8797aa",
    properties: {
      acceleration: {
        label: "Acceleration",
        min: -900,
        max: 900,
        step: 25,
        default: 0,
      },
      bounciness: {
        label: "Bounciness",
        min: 0,
        max: 2,
        step: 0.05,
        default: 0.25,
      },
    },
    solid: true,
    onCollision: platformCollision,
  },
  {
    id: "water",
    label: "Water",
    color: "#3189b8",
    properties: {
      viscosity: {
        label: "Viscosity (drag)",
        min: 0,
        max: 8,
        step: 0.1,
        default: 2.4,
      },
      buoyancy: {
        label: "Buoyancy (upward acceleration)",
        min: 0,
        max: 1800,
        step: 25,
        default: 600,
      },
    },
  },
  {
    id: "goal",
    label: "Goal",
    color: "#62d68a",
    properties: {},
    onOverlap: () => "goal",
  },
  {
    id: "hazard",
    label: "Hazard",
    color: "#ef5b5b",
    properties: {},
    onOverlap: () => "hazard",
  },
];

export const tileTypes = new Map<string, TileType>(
  definitions.map((definition) => [definition.id, definition]),
);

export const airType = tileTypes.get("air")!;

export function getTileType(typeId: string): TileType {
  const type = tileTypes.get(typeId);
  if (!type) {
    throw new Error(`Unknown tile type: ${typeId}`);
  }
  return type;
}

export function cellKey(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

export function createTileRegions(tiles: TileInstance[]): {
  regions: TileRegion[];
  regionByCell: Map<string, TileRegion>;
} {
  const tileByCell = new Map(tiles.map((tile) => [cellKey(tile), tile]));
  const visited = new Set<string>();
  const regions: TileRegion[] = [];
  const regionByCell = new Map<string, TileRegion>();

  for (const tile of tiles) {
    const startKey = cellKey(tile);
    if (visited.has(startKey)) {
      continue;
    }

    const region: TileRegion = {
      typeId: tile.typeId,
      cells: [],
      values: Object.fromEntries(
        Object.entries(getTileType(tile.typeId).properties).map(([key, property]) => [
          key,
          property.default,
        ]),
      ),
    };
    const pending = [tile];
    visited.add(startKey);

    while (pending.length > 0) {
      const current = pending.pop()!;
      region.cells.push({ x: current.x, y: current.y });
      regionByCell.set(cellKey(current), region);

      for (const neighbor of [
        { x: current.x + 1, y: current.y },
        { x: current.x - 1, y: current.y },
        { x: current.x, y: current.y + 1 },
        { x: current.x, y: current.y - 1 },
      ]) {
        const key = cellKey(neighbor);
        const adjacentTile = tileByCell.get(key);
        if (adjacentTile?.typeId === tile.typeId && !visited.has(key)) {
          visited.add(key);
          pending.push(adjacentTile);
        }
      }
    }

    regions.push(region);
  }

  return { regions, regionByCell };
}
