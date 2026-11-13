import { getCellRect, GRID_TOP, TILE_SIZE, type GameMap } from "./map";
import { cellKey, getTileType, type CollisionNormal, type TileInstance } from "./tiles";

export interface PhysicsBlock {
  x: number;
  y: number;
  size: number;
  velocityX: number;
  velocityY: number;
}

export interface PhysicsSimulation {
  block: PhysicsBlock;
  launch(): void;
  cancel(): void;
  update(deltaSeconds: number): void;
}

interface PhysicsElements {
  launchButton: HTMLButtonElement;
  cancelButton: HTMLButtonElement;
  launchCountElement: HTMLElement;
  statusElement: HTMLElement;
  onGoal?: (launches: number) => void;
}

export function createPhysicsSimulation(
  map: GameMap,
  elements: PhysicsElements,
): PhysicsSimulation {
  const { launchButton, cancelButton, launchCountElement, statusElement, onGoal } = elements;
  const block: PhysicsBlock = {
    x: (map.startCell.x + 0.5) * TILE_SIZE,
    y: GRID_TOP + (map.startCell.y + 1) * TILE_SIZE - 15,
    size: 30,
    velocityX: 0,
    velocityY: 0,
  };
  let launches = 0;
  let isRunning = false;

  function getProperties(tile: TileInstance): Readonly<Record<string, number>> {
    return map.regionByCell.get(cellKey(tile))?.values ?? {};
  }

  function getWaterEffect(): { viscosity: number; buoyancy: number; coverage: number } {
    let submergedArea = 0;
    let viscosityTotal = 0;
    let buoyancyTotal = 0;
    const half = block.size / 2;

    for (const tile of map.tiles) {
      if (tile.typeId !== "water") {
        continue;
      }

      const rect = getCellRect(tile);
      const overlapWidth = Math.max(
        0,
        Math.min(block.x + half, rect.x + rect.size) - Math.max(block.x - half, rect.x),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(block.y + half, rect.y + rect.size) - Math.max(block.y - half, rect.y),
      );
      const area = overlapWidth * overlapHeight;
      if (area === 0) {
        continue;
      }

      const properties = getProperties(tile);
      submergedArea += area;
      viscosityTotal += (properties.viscosity ?? 0) * area;
      buoyancyTotal += (properties.buoyancy ?? 0) * area;
    }

    if (submergedArea === 0) {
      return { viscosity: 0, buoyancy: 0, coverage: 0 };
    }
    return {
      viscosity: viscosityTotal / submergedArea,
      buoyancy: buoyancyTotal / submergedArea,
      coverage: Math.min(1, submergedArea / (block.size * block.size)),
    };
  }

  function resolveCollision(
    tile: TileInstance,
    normal: CollisionNormal,
    deltaSeconds: number,
  ): void {
    const type = getTileType(tile.typeId);
    if (!type.onCollision) {
      return;
    }

    if (!map.regionByCell.has(cellKey(tile))) {
      throw new Error("Colliding tile has no region");
    }
    const velocity = type.onCollision(
      { x: block.velocityX, y: block.velocityY },
      normal,
      getProperties(tile),
      deltaSeconds,
    );
    block.velocityX = velocity.x;
    block.velocityY = velocity.y;
  }

  function platformTiles(): TileInstance[] {
    return map.tiles.filter((tile) => getTileType(tile.typeId).solid);
  }

  function moveHorizontally(distance: number, deltaSeconds: number): void {
    block.x += distance;
    const half = block.size / 2;

    for (const tile of platformTiles()) {
      const rect = getCellRect(tile);
      const overlapsY = block.y + half > rect.y && block.y - half < rect.y + rect.size;
      const overlapsX = block.x + half > rect.x && block.x - half < rect.x + rect.size;
      if (distance === 0 && overlapsY) {
        if (Math.abs(block.x + half - rect.x) < 1e-7) {
          resolveCollision(tile, { x: -1, y: 0 }, deltaSeconds);
        } else if (Math.abs(block.x - half - (rect.x + rect.size)) < 1e-7) {
          resolveCollision(tile, { x: 1, y: 0 }, deltaSeconds);
        }
        continue;
      }
      if (!overlapsX || !overlapsY) {
        continue;
      }

      if (distance > 0) {
        block.x = rect.x - half;
        resolveCollision(tile, { x: -1, y: 0 }, deltaSeconds);
      } else if (distance < 0) {
        block.x = rect.x + rect.size + half;
        resolveCollision(tile, { x: 1, y: 0 }, deltaSeconds);
      }
      break;
    }
  }

  function moveVertically(
    distance: number,
    velocityBeforeGravity: number,
    deltaSeconds: number,
  ): void {
    const previousY = block.y;
    block.y += distance;
    const half = block.size / 2;

    for (const tile of platformTiles()) {
      const rect = getCellRect(tile);
      const overlapsX = block.x + half > rect.x && block.x - half < rect.x + rect.size;
      const overlapsY = block.y + half > rect.y && block.y - half < rect.y + rect.size;
      if (distance === 0 && overlapsX) {
        if (Math.abs(block.y + half - rect.y) < 1e-7) {
          resolveCollision(tile, { x: 0, y: -1 }, deltaSeconds);
        } else if (Math.abs(block.y - half - (rect.y + rect.size)) < 1e-7) {
          resolveCollision(tile, { x: 0, y: 1 }, deltaSeconds);
        }
        continue;
      }
      if (!overlapsX || !overlapsY) {
        continue;
      }

      if (distance > 0) {
        // Gravity on a resting block is not an impact and must not create artificial bounces.
        if (velocityBeforeGravity === 0 && Math.abs(previousY + half - rect.y) < 1e-7) {
          block.velocityY = 0;
        }
        block.y = rect.y - half;
        resolveCollision(tile, { x: 0, y: -1 }, deltaSeconds);
      } else if (distance < 0) {
        block.y = rect.y + rect.size + half;
        resolveCollision(tile, { x: 0, y: 1 }, deltaSeconds);
      }
      break;
    }
  }

  function finishAttempt(message: string): void {
    isRunning = false;
    block.x = (map.startCell.x + 0.5) * TILE_SIZE;
    block.y = GRID_TOP + (map.startCell.y + 1) * TILE_SIZE - block.size / 2;
    block.velocityX = 0;
    block.velocityY = 0;
    statusElement.textContent = message;
    launchButton.disabled = false;
    cancelButton.disabled = true;
  }

  function inspectOverlaps(): void {
    const half = block.size / 2;

    for (const tile of map.tiles) {
      const type = getTileType(tile.typeId);
      if (!type.onOverlap) {
        continue;
      }

      const rect = getCellRect(tile);
      const overlaps =
        block.x + half > rect.x &&
        block.x - half < rect.x + rect.size &&
        block.y + half > rect.y &&
        block.y - half < rect.y + rect.size;
      if (!overlaps) {
        continue;
      }

      const outcome = type.onOverlap(getProperties(tile));
      if (outcome === "hazard") {
        finishAttempt("Hazard hit — try another launch.");
        return;
      }
      if (outcome === "goal") {
        isRunning = false;
        block.velocityX = 0;
        block.velocityY = 0;
        statusElement.textContent = `Goal reached in ${launches} ${launches === 1 ? "launch" : "launches"}!`;
        launchButton.disabled = false;
        cancelButton.disabled = true;
        onGoal?.(launches);
        return;
      }
    }
  }

  function update(deltaSeconds: number): void {
    if (!isRunning) {
      return;
    }

    let remaining = deltaSeconds;
    while (remaining > 0 && isRunning) {
      const water = getWaterEffect();
      const verticalAcceleration = map.airValues.gravity - water.buoyancy * water.coverage;
      const maxSpeed = Math.max(
        Math.abs(block.velocityX),
        Math.abs(block.velocityY) + Math.abs(verticalAcceleration) * remaining,
      );
      const step = Math.min(
        remaining,
        1 / 120,
        maxSpeed > 0 ? TILE_SIZE / 4 / maxSpeed : remaining,
      );
      const velocityBeforeGravity = block.velocityY;
      block.velocityY += verticalAcceleration * step;
      const drag = Math.exp(-water.viscosity * water.coverage * step);
      block.velocityX *= drag;
      block.velocityY *= drag;
      moveHorizontally(block.velocityX * step, step);
      moveVertically(block.velocityY * step, velocityBeforeGravity, step);
      inspectOverlaps();

      if (
        isRunning &&
        (block.x + block.size / 2 < 0 ||
          block.x - block.size / 2 > map.gridPixelWidth ||
          block.y - block.size / 2 > map.gridPixelHeight)
      ) {
        finishAttempt("The block fell off the level — try again.");
      }
      remaining -= step;
    }
  }

  function launch(): void {
    if (isRunning) {
      return;
    }

    block.x = (map.startCell.x + 0.5) * TILE_SIZE;
    block.y = GRID_TOP + (map.startCell.y + 1) * TILE_SIZE - block.size / 2;
    block.velocityX = map.airValues.launchVelocity;
    block.velocityY = 0;
    launches += 1;
    launchCountElement.textContent = String(launches);
    statusElement.textContent = "In flight…";
    isRunning = true;
    launchButton.disabled = true;
    cancelButton.disabled = false;
  }

  function cancel(): void {
    if (isRunning) {
      finishAttempt("Launch canceled.");
    }
  }

  return { block, launch, cancel, update };
}
