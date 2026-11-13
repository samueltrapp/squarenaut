import "./style.css";
import { startAnimation } from "./animation";
import { createMap, GRID_TOP, TILE_SIZE } from "./map";
import { createPhysicsSimulation } from "./physics";
import { loadLevel, type LevelDefinition } from "./level-format";
import { readEditorDraft } from "./level-session";
import { drawScorecard, formatScorecard, shareScorecard } from "./scorecard";
import {
  airType,
  cellKey,
  getTileType,
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
const dailyButtonElement = document.querySelector<HTMLButtonElement>("#daily");
const scorecardElement = document.querySelector<HTMLElement>("#daily-scorecard");
const scorecardTextElement = document.querySelector<HTMLElement>("#scorecard-text");
const scorecardImageElement = document.querySelector<HTMLImageElement>("#scorecard-image");
const shareScorecardButtonElement = document.querySelector<HTMLButtonElement>("#share-scorecard");

if (
  !canvasElement ||
  !launchButtonElement ||
  !cancelButtonElement ||
  !launchCountElementElement ||
  !statusElementElement ||
  !controlsElementElement ||
  !dailyButtonElement ||
  !scorecardElement ||
  !scorecardTextElement ||
  !scorecardImageElement ||
  !shareScorecardButtonElement
) {
  throw new Error("Game interface is incomplete");
}

const canvas: HTMLCanvasElement = canvasElement;
const launchButton: HTMLButtonElement = launchButtonElement;
const cancelButton: HTMLButtonElement = cancelButtonElement;
const launchCountElement: HTMLElement = launchCountElementElement;
const statusElement: HTMLElement = statusElementElement;
const controlsElement: HTMLElement = controlsElementElement;
const dailyButton: HTMLButtonElement = dailyButtonElement;
const scorecardElementContainer: HTMLElement = scorecardElement;
const scorecardText: HTMLElement = scorecardTextElement;
const scorecardImage: HTMLImageElement = scorecardImageElement;
const shareScorecardButton: HTMLButtonElement = shareScorecardButtonElement;
const canvasContext = canvas.getContext("2d");
if (!canvasContext) {
  throw new Error("Canvas 2D context is not available");
}
const context: CanvasRenderingContext2D = canvasContext;
let map = createMap(canvas.width, canvas.height);
let selectedRegion: TileRegion | undefined;
let dailyDate: string | undefined;
let dailyPar: number | undefined;
let shareableScorecard:
  | {
      canvas: HTMLCanvasElement;
      scorecard: { date: string; launches: number; par?: number };
    }
  | undefined;

function showScorecard(date: string, launches: number, par: number | undefined): void {
  const scorecard = { date, launches, ...(par === undefined ? {} : { par }) };
  const scorecardCanvas = document.createElement("canvas");
  scorecardCanvas.width = 720;
  scorecardCanvas.height = 400;
  const scorecardContext = scorecardCanvas.getContext("2d");
  if (!scorecardContext) {
    throw new Error("Canvas 2D context is not available for the scorecard");
  }
  drawScorecard(scorecardContext, scorecard);
  scorecardText.textContent = formatScorecard(scorecard);
  scorecardImage.src = scorecardCanvas.toDataURL("image/png");
  scorecardElementContainer.hidden = false;
  shareableScorecard = { canvas: scorecardCanvas, scorecard };
}

function createPhysics(levelMap: typeof map): ReturnType<typeof createPhysicsSimulation> {
  return createPhysicsSimulation(levelMap, {
    launchButton,
    cancelButton,
    launchCountElement,
    statusElement,
    onGoal: (launches) => {
      if (dailyDate) {
        showScorecard(dailyDate, launches, dailyPar);
      }
    },
  });
}

let physics = createPhysics(map);

function showLevel(level: LevelDefinition, message: string, date?: string): void {
  dailyDate = date;
  dailyPar = date ? level.par : undefined;
  shareableScorecard = undefined;
  map = createMap(canvas.width, canvas.height, level);
  physics = createPhysics(map);
  selectedRegion = undefined;
  launchCountElement.textContent = "0";
  launchButton.disabled = false;
  cancelButton.disabled = true;
  statusElement.textContent = message;
  scorecardElementContainer.hidden = true;
  createPhysicsControls();
}

async function loadDaily(): Promise<void> {
  dailyButton.disabled = true;
  const date = new Date().toISOString().slice(0, 10);
  statusElement.textContent = `Loading daily level for ${date}…`;
  try {
    const url = new URL(`levels/daily/${date}.json`, document.baseURI);
    const response = await fetch(url);
    if (response.status === 404) {
      throw new Error(`No daily level is available for ${date}.`);
    }
    if (!response.ok) {
      throw new Error(`Daily level request failed (${response.status}).`);
    }
    if (response.headers.get("content-type")?.includes("text/html")) {
      throw new Error(`No daily level is available for ${date}.`);
    }
    const level = loadLevel(await response.json());
    showLevel(level, `Daily level for ${date}. Ready to launch.`, date);
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has("playtest")) {
      currentUrl.searchParams.delete("playtest");
      window.history.replaceState(null, "", currentUrl);
    }
  } catch (error) {
    statusElement.textContent =
      error instanceof Error ? error.message : "Could not load the daily level.";
  } finally {
    dailyButton.disabled = false;
  }
}

function createPhysicsControls(): void {
  const tileType: TileType = selectedRegion ? getTileType(selectedRegion.typeId) : airType;
  const values: TileProperties = selectedRegion ? selectedRegion.values : map.airValues;
  const section = document.createElement("section");
  section.className = "tile-control-group";

  const heading = document.createElement("h3");
  const groupNumber = selectedRegion
    ? map.regions
        .filter((region) => region.typeId === selectedRegion?.typeId)
        .indexOf(selectedRegion) + 1
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

function selectMapCell(event: MouseEvent): void {
  const bounds = canvas.getBoundingClientRect();
  const viewportX = ((event.clientX - bounds.left) * canvas.width) / bounds.width;
  const viewportY = ((event.clientY - bounds.top) * canvas.height) / bounds.height;
  const x = (viewportX - map.viewport.offsetX) / map.viewport.scale;
  const y = (viewportY - map.viewport.offsetY) / map.viewport.scale;
  const cell = {
    x: Math.floor(x / TILE_SIZE),
    y: Math.floor((y - GRID_TOP) / TILE_SIZE),
  };
  if (cell.x < 0 || cell.x >= map.gridWidth || cell.y < 0 || cell.y >= map.gridHeight) {
    return;
  }
  selectedRegion = map.regionByCell.get(cellKey(cell));
  createPhysicsControls();
}

launchButton.addEventListener("click", () => physics.launch());
cancelButton.addEventListener("click", () => physics.cancel());
dailyButton.addEventListener("click", () => void loadDaily());
shareScorecardButton.addEventListener("click", async () => {
  if (!shareableScorecard) {
    return;
  }
  shareScorecardButton.disabled = true;
  try {
    const result = await shareScorecard(shareableScorecard.canvas, shareableScorecard.scorecard);
    statusElement.textContent =
      result === "shared" ? "Scorecard shared." : "Scorecard text copied to the clipboard.";
  } catch (error) {
    statusElement.textContent =
      error instanceof Error
        ? `Could not share the scorecard: ${error.message}`
        : "Could not share the scorecard.";
  } finally {
    shareScorecardButton.disabled = false;
  }
});
canvas.addEventListener("click", selectMapCell);

createPhysicsControls();
if (new URL(window.location.href).searchParams.get("playtest") === "1") {
  try {
    showLevel(readEditorDraft(sessionStorage), "Editor playtest. Ready to launch.");
  } catch (error) {
    statusElement.textContent = `Could not load the editor playtest: ${
      error instanceof Error ? error.message : "Unknown error."
    }`;
  }
}
startAnimation(
  canvas,
  context,
  () => ({ map, physics }),
  () => selectedRegion,
);
