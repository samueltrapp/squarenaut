import './style.css';
import { defaultLevel, GRID_TOP, TILE_SIZE } from './level';
import { loadLevel, serializeLevel } from './level-format';
import { fitGridToViewport } from './level';
import { getTileType } from './tiles';
import { EDITOR_DRAFT_KEY, readEditorDraft, writeEditorDraft } from './level-session';

const canvasElement = document.querySelector<HTMLCanvasElement>('#editor-canvas');
const widthElement = document.querySelector<HTMLInputElement>('#grid-width');
const heightElement = document.querySelector<HTMLInputElement>('#grid-height');
const resizeButton = document.querySelector<HTMLButtonElement>('#resize-grid');
const fileInput = document.querySelector<HTMLInputElement>('#load-level');
const statusElement = document.querySelector<HTMLElement>('#editor-status');
const saveButton = document.querySelector<HTMLButtonElement>('#save-level');
const loadSavedButton = document.querySelector<HTMLButtonElement>('#load-saved');
const exportButton = document.querySelector<HTMLButtonElement>('#export-level');
const testButton = document.querySelector<HTMLButtonElement>('#test-level');
const backLink = document.querySelector<HTMLAnchorElement>('#back-to-game');

if (
  !canvasElement ||
  !widthElement ||
  !heightElement ||
  !resizeButton ||
  !fileInput ||
  !statusElement ||
  !saveButton ||
  !loadSavedButton ||
  !exportButton ||
  !testButton ||
  !backLink
) {
  throw new Error('Level editor interface is incomplete');
}

const canvas = canvasElement;
const context = canvas.getContext('2d');
if (!context) {
  throw new Error('Canvas 2D context is not available');
}
const canvasContext: CanvasRenderingContext2D = context;
const editorStatus: HTMLElement = statusElement;
const gridWidthInput: HTMLInputElement = widthElement;
const gridHeightInput: HTMLInputElement = heightElement;

let level = serializeLevel(defaultLevel);
let selectedTool = 'platform';
let isPainting = false;
let lastPaintedCell = '';

function setStatus(message: string): void {
  editorStatus.textContent = message;
}

function setGridCanvasSize(): void {
  canvas.width = level.grid.width * TILE_SIZE;
  canvas.height = GRID_TOP + level.grid.height * TILE_SIZE;
}

function drawLevel(): void {
  setGridCanvasSize();
  const { scale, offsetX, offsetY } = fitGridToViewport(
    canvas.width,
    canvas.height,
    level.grid.width,
    level.grid.height,
  );
  canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  canvasContext.fillStyle = getTileType('air').color;
  canvasContext.fillRect(0, GRID_TOP, level.grid.width * TILE_SIZE, level.grid.height * TILE_SIZE);

  for (const tile of level.tiles) {
    const type = getTileType(tile.typeId);
    const x = tile.x * TILE_SIZE;
    const y = GRID_TOP + tile.y * TILE_SIZE;
    if (tile.typeId === 'water') {
      canvasContext.fillStyle = `${type.color}b8`;
      canvasContext.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    } else if (tile.typeId === 'hazard') {
      canvasContext.fillStyle = type.color;
      canvasContext.beginPath();
      canvasContext.moveTo(x + 5, y + TILE_SIZE - 5);
      canvasContext.lineTo(x + TILE_SIZE / 2, y + 5);
      canvasContext.lineTo(x + TILE_SIZE - 5, y + TILE_SIZE - 5);
      canvasContext.closePath();
      canvasContext.fill();
    } else {
      canvasContext.fillStyle = type.color;
      canvasContext.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      canvasContext.fillStyle = '#b7c3d0';
      canvasContext.fillRect(x, y, TILE_SIZE, 5);
    }
  }

  const goalX = level.goal.x * TILE_SIZE;
  const goalY = GRID_TOP + level.goal.y * TILE_SIZE;
  canvasContext.fillStyle = '#245b43';
  canvasContext.fillRect(goalX + 4, goalY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  canvasContext.strokeStyle = getTileType('goal').color;
  canvasContext.lineWidth = 3;
  canvasContext.strokeRect(goalX + 7, goalY + 7, TILE_SIZE - 14, TILE_SIZE - 14);
  canvasContext.fillStyle = getTileType('goal').color;
  canvasContext.beginPath();
  canvasContext.arc(goalX + TILE_SIZE / 2, goalY + TILE_SIZE / 2, 8, 0, Math.PI * 2);
  canvasContext.fill();

  const startX = (level.start.x + 0.5) * TILE_SIZE;
  const startY = GRID_TOP + (level.start.y + 1) * TILE_SIZE - 16;
  canvasContext.fillStyle = '#dbeaf7';
  canvasContext.beginPath();
  canvasContext.moveTo(startX - 18, startY - 27);
  canvasContext.lineTo(startX - 5, startY - 22);
  canvasContext.lineTo(startX - 18, startY - 17);
  canvasContext.closePath();
  canvasContext.fill();

  canvasContext.strokeStyle = 'rgb(183 201 219 / 24%)';
  canvasContext.lineWidth = 1;
  for (let x = 0; x <= level.grid.width; x += 1) {
    canvasContext.beginPath();
    canvasContext.moveTo(x * TILE_SIZE + 0.5, GRID_TOP);
    canvasContext.lineTo(x * TILE_SIZE + 0.5, GRID_TOP + level.grid.height * TILE_SIZE);
    canvasContext.stroke();
  }
  for (let y = 0; y <= level.grid.height; y += 1) {
    canvasContext.beginPath();
    canvasContext.moveTo(0, GRID_TOP + y * TILE_SIZE + 0.5);
    canvasContext.lineTo(level.grid.width * TILE_SIZE, GRID_TOP + y * TILE_SIZE + 0.5);
    canvasContext.stroke();
  }
}

function getCell(event: PointerEvent): { x: number; y: number } | undefined {
  const bounds = canvas.getBoundingClientRect();
  const viewportX = ((event.clientX - bounds.left) * canvas.width) / bounds.width;
  const viewportY = ((event.clientY - bounds.top) * canvas.height) / bounds.height;
  const { scale, offsetX, offsetY } = fitGridToViewport(
    canvas.width,
    canvas.height,
    level.grid.width,
    level.grid.height,
  );
  const x = Math.floor(((viewportX - offsetX) / scale) / TILE_SIZE);
  const y = Math.floor((((viewportY - offsetY) / scale) - GRID_TOP) / TILE_SIZE);
  if (x < 0 || x >= level.grid.width || y < 0 || y >= level.grid.height) {
    return undefined;
  }
  return { x, y };
}

function paintCell(cell: { x: number; y: number }): void {
  const key = `${cell.x},${cell.y}`;
  if (key === lastPaintedCell) {
    return;
  }
  lastPaintedCell = key;

  if (selectedTool === 'start' || selectedTool === 'goal') {
    const otherMarker = selectedTool === 'start' ? level.goal : level.start;
    if (cell.x === otherMarker.x && cell.y === otherMarker.y) {
      setStatus('Start and goal must be different cells.');
      return;
    }
    level[selectedTool] = cell;
  } else {
    const index = level.tiles.findIndex((tile) => tile.x === cell.x && tile.y === cell.y);
    if (selectedTool === 'erase') {
      if (index >= 0) {
        level.tiles.splice(index, 1);
      }
    } else if (index >= 0) {
      level.tiles[index] = { ...cell, typeId: selectedTool };
    } else {
      level.tiles.push({ ...cell, typeId: selectedTool });
    }
  }
  drawLevel();
}

function applyLoadedLevel(value: unknown): void {
  level = loadLevel(value);
  gridWidthInput.value = String(level.grid.width);
  gridHeightInput.value = String(level.grid.height);
  drawLevel();
}

document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedTool = button.dataset.tool ?? 'platform';
    document.querySelectorAll('[data-tool]').forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
  });
});

canvas.addEventListener('pointerdown', (event) => {
  const cell = getCell(event);
  if (!cell) {
    return;
  }
  isPainting = true;
  lastPaintedCell = '';
  canvas.setPointerCapture(event.pointerId);
  paintCell(cell);
});
canvas.addEventListener('pointermove', (event) => {
  if (isPainting) {
    const cell = getCell(event);
    if (cell) {
      paintCell(cell);
    }
  }
});
canvas.addEventListener('pointerup', () => {
  isPainting = false;
  lastPaintedCell = '';
});
canvas.addEventListener('pointercancel', () => {
  isPainting = false;
  lastPaintedCell = '';
});

resizeButton.addEventListener('click', () => {
  try {
    applyLoadedLevel({
      ...level,
      grid: { width: Number(gridWidthInput.value), height: Number(gridHeightInput.value) },
    });
    setStatus('Grid resized.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not resize the grid.');
  }
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) {
    return;
  }
  try {
    applyLoadedLevel(JSON.parse(await file.text()));
    setStatus(`Loaded ${file.name}.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not load this level.');
  } finally {
    fileInput.value = '';
  }
});

saveButton.addEventListener('click', () => {
  try {
    localStorage.setItem('squarenaut-level', JSON.stringify(serializeLevel(level)));
    setStatus('Level saved in this browser.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not save this level.');
  }
});

loadSavedButton.addEventListener('click', () => {
  try {
    const savedLevel = localStorage.getItem('squarenaut-level');
    if (!savedLevel) {
      throw new Error('There is no saved level in this browser.');
    }
    applyLoadedLevel(JSON.parse(savedLevel));
    setStatus('Saved level loaded.');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Could not load the saved level.');
  }
});

exportButton.addEventListener('click', () => {
  const contents = JSON.stringify(serializeLevel(level), null, 2);
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'squarenaut-level.json';
  link.click();
  URL.revokeObjectURL(url);
  setStatus('Level exported as JSON.');
});

function saveDraft(): boolean {
  try {
    writeEditorDraft(sessionStorage, level);
    return true;
  } catch (error) {
    setStatus(`Could not preserve the editor draft: ${
      error instanceof Error ? error.message : 'Unknown error.'
    }`);
    return false;
  }
}

testButton.addEventListener('click', () => {
  if (saveDraft()) {
    window.location.assign(new URL('./index.html?playtest=1', document.baseURI));
  }
});

backLink.addEventListener('click', (event) => {
  if (!saveDraft()) {
    event.preventDefault();
  }
});

try {
  if (sessionStorage.getItem(EDITOR_DRAFT_KEY) !== null) {
    applyLoadedLevel(readEditorDraft(sessionStorage));
    setStatus('Editor draft restored.');
  } else {
    drawLevel();
  }
} catch (error) {
  drawLevel();
  setStatus(`Could not restore the editor draft: ${
    error instanceof Error ? error.message : 'Unknown error.'
  }`);
}
