import "./style.css";
import {
  fitGridToViewport,
  GRID_HEIGHT,
  GRID_TOP,
  GRID_WIDTH,
  levelTiles,
  startCell,
  TILE_SIZE,
} from "./level";
import {
  airType,
  cellKey,
  createTileRegions,
  getTileType,
  type Cell,
  type CollisionNormal,
  type TileInstance,
  type TileProperties,
  type TileRegion,
  type TileType,
} from "./tiles";

const canvasElement = document.querySelector<HTMLCanvasElement>("#game");
const launchButtonElement = document.querySelector<HTMLButtonElement>("#launch");
const cancelButtonElement = document.querySelector<HTMLButtonElement>("#cancel");
const launchCountElementElement = document.querySelector<HTMLElement>("#launch-count");
const statusElementElement = document.querySelector<HTMLElement>("#game-status");
const controlsElementElement = document.querySelector<HTMLElement>("#physics-controls");

if (
  !canvasElement ||
  !launchButtonElement ||
  !cancelButtonElement ||
  !launchCountElementElement ||
  !statusElementElement ||
  !controlsElementElement
) {
  throw new Error("Game interface is incomplete");
}

const canvas: HTMLCanvasElement = canvasElement;
const launchButton: HTMLButtonElement = launchButtonElement;
const cancelButton: HTMLButtonElement = cancelButtonElement;
const launchCountElement: HTMLElement = launchCountElementElement;
const statusElement: HTMLElement = statusElementElement;
const controlsElement: HTMLElement = controlsElementElement;
const canvasContext = canvas.getContext("2d");
if (!canvasContext) {
  throw new Error("Canvas 2D context is not available");
}
const context: CanvasRenderingContext2D = canvasContext;
const gridPixelWidth = GRID_WIDTH * TILE_SIZE;
const gridPixelHeight = GRID_TOP + GRID_HEIGHT * TILE_SIZE;
const viewport = fitGridToViewport(canvas.width, canvas.height);

const { regions, regionByCell } = createTileRegions(levelTiles);
const airValues: TileProperties = Object.fromEntries(
  Object.entries(airType.properties).map(([key, property]) => [key, property.default]),
);
let selectedRegion: TileRegion | undefined;
const block = {
  x: (startCell.x + 0.5) * TILE_SIZE,
  y: GRID_TOP + (startCell.y + 1) * TILE_SIZE - 15,
  size: 30,
  velocityX: 0,
  velocityY: 0,
};

let launches = 0;
let isRunning = false;
let previousFrameTime = 0;

function getProperties(tile: TileInstance): Readonly<Record<string, number>> {
  return regionByCell.get(cellKey(tile))?.values ?? {};
}

function createPhysicsControls(): void {
  const tileType: TileType = selectedRegion ? getTileType(selectedRegion.typeId) : airType;
  const values = selectedRegion ? selectedRegion.values : airValues;
  const section = document.createElement("section");
  section.className = "tile-control-group";

  const heading = document.createElement("h3");
  const groupNumber = selectedRegion
    ? regions.filter((region) => region.typeId === selectedRegion?.typeId).indexOf(selectedRegion) +
      1
    : undefined;
  heading.textContent = groupNumber
    ? `${tileType.label} · ${groupNumber}`
    : `${tileType.label} · Global`;
  section.append(heading);

  if (Object.keys(tileType.properties).length === 0) {
    const empty = document.createElement("p");
    empty.className = "no-properties";
    empty.textContent = "This tile has no editable properties.";
    section.append(empty);
  }

  for (const [propertyId, property] of Object.entries(tileType.properties)) {
    const wrapper = document.createElement("div");
    wrapper.className = "property-control";

    const label = document.createElement("label");
    label.className = "property-label";
    label.htmlFor = `property-${propertyId}`;

    const name = document.createElement("span");
    name.textContent = property.label;
    const value = document.createElement("span");
    value.className = "property-value";
    value.textContent = values[propertyId].toFixed(2);
    label.append(name, value);

    const slider = document.createElement("input");
    slider.id = label.htmlFor;
    slider.type = "range";
    slider.min = String(property.min);
    slider.max = String(property.max);
    slider.step = String(property.step);
    slider.value = String(values[propertyId]);
    slider.setAttribute("aria-label", `${heading.textContent} ${property.label}`);
    slider.addEventListener("input", () => {
      const nextValue = Number(slider.value);
      values[propertyId] = nextValue;
      value.textContent = nextValue.toFixed(2);
    });

    wrapper.append(label, slider);
    section.append(wrapper);
  }
  controlsElement.replaceChildren(section);
}

function cellRect(cell: Cell): { x: number; y: number; size: number } {
  return {
    x: cell.x * TILE_SIZE,
    y: GRID_TOP + cell.y * TILE_SIZE,
    size: TILE_SIZE,
  };
}

function drawTile(tile: TileInstance): void {
  const type = getTileType(tile.typeId);
  const { x, y, size } = cellRect(tile);

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

function drawStartMarker(): void {
  const x = (startCell.x + 0.5) * TILE_SIZE;
  const y = GRID_TOP + (startCell.y + 1) * TILE_SIZE - 16;
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

function drawBlock(): void {
  const half = block.size / 2;
  context.fillStyle = "#f3c86a";
  context.fillRect(block.x - half, block.y - half, block.size, block.size);
  context.fillStyle = "#684d27";
  context.fillRect(block.x - 7, block.y - 5, 4, 4);
  context.fillRect(block.x + 3, block.y - 5, 4, 4);
  context.fillRect(block.x - 5, block.y + 5, 10, 3);
}

function draw(): void {
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.offsetX, viewport.offsetY);
  context.fillStyle = airType.color;
  context.fillRect(0, GRID_TOP, gridPixelWidth, GRID_HEIGHT * TILE_SIZE);

  for (const tile of levelTiles) {
    drawTile(tile);
  }

  drawStartMarker();

  context.strokeStyle = "rgb(183 201 219 / 10%)";
  context.lineWidth = 1;
  for (let x = 0; x <= GRID_WIDTH; x += 1) {
    const gridX = x * TILE_SIZE + 0.5;
    context.beginPath();
    context.moveTo(gridX, GRID_TOP);
    context.lineTo(gridX, GRID_TOP + GRID_HEIGHT * TILE_SIZE);
    context.stroke();
  }
  for (let y = 0; y <= GRID_HEIGHT; y += 1) {
    const gridY = GRID_TOP + y * TILE_SIZE + 0.5;
    context.beginPath();
    context.moveTo(0, gridY);
    context.lineTo(GRID_WIDTH * TILE_SIZE, gridY);
    context.stroke();
  }

  if (selectedRegion) {
    context.strokeStyle = "#9de7ba";
    context.lineWidth = 2;
    for (const cell of selectedRegion.cells) {
      const rect = cellRect(cell);
      context.strokeRect(rect.x + 2, rect.y + 2, rect.size - 4, rect.size - 4);
    }
  }

  drawBlock();
}

function platformTiles(): TileInstance[] {
  return levelTiles.filter((tile) => getTileType(tile.typeId).solid);
}

function resolveCollision(tile: TileInstance, normal: CollisionNormal, deltaSeconds: number): void {
  const type = getTileType(tile.typeId);
  if (!type.onCollision) {
    return;
  }

  if (!regionByCell.has(cellKey(tile))) {
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

function moveHorizontally(distance: number, deltaSeconds: number): void {
  block.x += distance;
  const half = block.size / 2;

  for (const tile of platformTiles()) {
    const rect = cellRect(tile);
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
    const rect = cellRect(tile);
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
  block.x = (startCell.x + 0.5) * TILE_SIZE;
  block.y = GRID_TOP + (startCell.y + 1) * TILE_SIZE - block.size / 2;
  block.velocityX = 0;
  block.velocityY = 0;
  statusElement.textContent = message;
  launchButton.disabled = false;
  cancelButton.disabled = true;
}

function inspectOverlaps(): void {
  const half = block.size / 2;

  for (const tile of levelTiles) {
    const type = getTileType(tile.typeId);
    if (!type.onOverlap) {
      continue;
    }

    const rect = cellRect(tile);
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
    const maxSpeed = Math.max(
      Math.abs(block.velocityX),
      Math.abs(block.velocityY) + airValues.gravity * remaining,
    );
    const step = Math.min(remaining, 1 / 120, maxSpeed > 0 ? TILE_SIZE / 4 / maxSpeed : remaining);
    const velocityBeforeGravity = block.velocityY;
    block.velocityY += airValues.gravity * step;
    moveHorizontally(block.velocityX * step, step);
    moveVertically(block.velocityY * step, velocityBeforeGravity, step);
    inspectOverlaps();

    if (
      isRunning &&
      (block.x + block.size / 2 < 0 ||
        block.x - block.size / 2 > gridPixelWidth ||
        block.y - block.size / 2 > gridPixelHeight)
    ) {
      finishAttempt("The block fell off the level — try again.");
    }
    remaining -= step;
  }
}

function frame(timestamp: number): void {
  const deltaSeconds =
    previousFrameTime === 0 ? 0 : Math.min((timestamp - previousFrameTime) / 1000, 0.04);
  previousFrameTime = timestamp;
  update(deltaSeconds);
  draw();
  requestAnimationFrame(frame);
}

launchButton.addEventListener("click", () => {
  if (isRunning) {
    return;
  }

  block.x = (startCell.x + 0.5) * TILE_SIZE;
  block.y = GRID_TOP + (startCell.y + 1) * TILE_SIZE - block.size / 2;
  block.velocityX = airValues.launchVelocity;
  block.velocityY = 0;
  launches += 1;
  launchCountElement.textContent = String(launches);
  statusElement.textContent = "In flight…";
  isRunning = true;
  launchButton.disabled = true;
  cancelButton.disabled = false;
});

cancelButton.addEventListener("click", () => {
  if (isRunning) {
    finishAttempt("Launch canceled.");
  }
});

canvas.addEventListener("click", (event) => {
  const bounds = canvas.getBoundingClientRect();
  const viewportX = ((event.clientX - bounds.left) * canvas.width) / bounds.width;
  const viewportY = ((event.clientY - bounds.top) * canvas.height) / bounds.height;
  const x = (viewportX - viewport.offsetX) / viewport.scale;
  const y = (viewportY - viewport.offsetY) / viewport.scale;
  const cell = {
    x: Math.floor(x / TILE_SIZE),
    y: Math.floor((y - GRID_TOP) / TILE_SIZE),
  };
  if (cell.x < 0 || cell.x >= GRID_WIDTH || cell.y < 0 || cell.y >= GRID_HEIGHT) {
    return;
  }
  selectedRegion = regionByCell.get(cellKey(cell));
  createPhysicsControls();
});

createPhysicsControls();
requestAnimationFrame(frame);
