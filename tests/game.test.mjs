import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";
import { expect, test } from "vitest";

async function moduleUrl(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { code } = await transformWithOxc(source, path);
  return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
}

const tilesUrl = await moduleUrl("../src/tiles.ts");
const tiles = await import(tilesUrl);
const levelUrl = await moduleUrl("../src/level.ts");
const level = await import(levelUrl);
const { fitGridToViewport } = level;
const mainSource = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
let appNumber = 0;

class Element {
  children = [];
  listeners = new Map();
  textContent = "";
  value = "";

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  setAttribute() {}

  emit(type, event = {}) {
    this.listeners.get(type)?.(event);
  }
}

async function createApp() {
  const elements = Object.fromEntries(
    ["game", "launch", "cancel", "launch-count", "game-status", "physics-controls"].map((id) => [
      id,
      new Element(),
    ]),
  );
  let position;
  const context = {
    setTransform() {},
    fillRect(x, y, width, height) {
      if (this.fillStyle === "#f3c86a") position = { x: x + width / 2, y: y + height / 2 };
    },
    clearRect() {},
    strokeRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    arc() {},
    closePath() {},
    fill() {},
    stroke() {},
  };
  const canvas = elements.game;
  canvas.width = 960;
  canvas.height = 540;
  canvas.getContext = () => context;
  canvas.getBoundingClientRect = () => ({
    left: 10,
    top: 20,
    width: 480,
    height: (480 * canvas.height) / canvas.width,
  });
  globalThis.document = {
    querySelector: (selector) => elements[selector.slice(1)],
    createElement: () => new Element(),
  };
  let nextFrame;
  globalThis.requestAnimationFrame = (callback) => {
    nextFrame = callback;
  };
  const source = mainSource
    .replace('import "./style.css";', "")
    .replace('from "./level"', `from "${levelUrl}"`)
    .replace('from "./tiles"', `from "${tilesUrl}"`);
  const { code } = await transformWithOxc(source, "main.ts");
  await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}#${appNumber++}`
  );

  return {
    elements,
    frame: (time) => nextFrame(time),
    position: () => position,
    select: (x, y) => {
      const bounds = canvas.getBoundingClientRect();
      const { scale, offsetX, offsetY } = fitGridToViewport(canvas.width, canvas.height);
      canvas.emit("click", {
        clientX: bounds.left + ((x * scale + offsetX) * bounds.width) / canvas.width,
        clientY: bounds.top + ((y * scale + offsetY) * bounds.height) / canvas.height,
      });
    },
    section: () => elements["physics-controls"].children[0],
    slider: (id) =>
      elements["physics-controls"].children[0].children
        .flatMap((child) => child.children)
        .find((child) => child.id === `property-${id}`),
    setSlider(id, value) {
      const slider = this.slider(id);
      slider.value = String(value);
      slider.emit("input");
    },
  };
}

test("platform acceleration accumulates with contact duration and bounciness sets bounce height", () => {
  const platform = tiles.getTileType("platform");
  expect([platform.properties.acceleration.min, platform.properties.acceleration.max]).toEqual([
    -900, 900,
  ]);
  expect(platform.properties.acceleration.default).toBe(0);
  expect([platform.properties.bounciness.min, platform.properties.bounciness.max]).toEqual([0, 2]);
  expect(tiles.getTileType("air").properties.time).toBeUndefined();

  let velocity = { x: 100, y: 0 };
  for (let step = 0; step < 4; step += 1) {
    velocity = platform.onCollision(
      velocity,
      { x: 0, y: -1 },
      { acceleration: 200, bounciness: 0 },
      0.25,
    );
  }
  expect(velocity.x).toBe(300);

  const reversed = platform.onCollision(
    { x: 100, y: 0 },
    { x: 0, y: -1 },
    { acceleration: -300, bounciness: 0 },
    0.5,
  );
  expect(reversed.x).toBe(-50);

  const bounced = platform.onCollision(
    { x: 100, y: 100 },
    { x: 0, y: -1 },
    { acceleration: 0, bounciness: 2 },
    0,
  );
  expect(bounced.x).toBe(100);
  expect(Math.abs(bounced.y ** 2 / 100 ** 2 - 2)).toBeLessThan(1e-12);

  const resting = platform.onCollision(
    { x: 100, y: 10 },
    { x: 0, y: -1 },
    {
      acceleration: 0,
      bounciness: 0,
    },
    0,
  );
  expect(resting).toEqual({ x: 100, y: 0 });
  const wall = platform.onCollision(
    { x: 100, y: 100 },
    { x: -1, y: 0 },
    {
      acceleration: 0,
      bounciness: 0,
    },
    0,
  );
  expect(wall).toEqual({ x: 0, y: 100 });
});

test("selection shows one group, preserves edits, and returns to global air", async () => {
  const app = await createApp();
  expect(app.section().children[0].textContent).toBe("Air · Global");
  expect(app.elements.game.width).toBe(960);
  expect(app.elements.game.height).toBe(540);
  app.setSlider("gravity", 0);
  app.select(24, 174);
  expect(app.section().children[0].textContent).toBe("Platform · 1");
  app.setSlider("acceleration", -250);
  app.select(120, 174);
  expect(app.slider("acceleration").value).toBe("-250");
  app.select(24, 250);
  expect(app.section().children[0].textContent).toBe("Air · Global");
  expect(app.slider("gravity").value).toBe("0");
  expect(app.slider("launchVelocity").value).toBe("600");
  app.select(456, 462);
  expect(app.section().children[0].textContent).toBe("Water · 1");
  expect(app.section().children[1].textContent).toMatch(/no editable properties/);
  expect(app.elements["physics-controls"].children.length).toBe(1);
});

test("grid viewport fits different level sizes without changing canvas dimensions", () => {
  for (const [gridWidth, gridHeight] of [
    [30, 20],
    [12, 8],
    [40, 30],
  ]) {
    const { scale, offsetX, offsetY } = fitGridToViewport(960, 540, gridWidth, gridHeight);
    const fittedWidth = gridWidth * level.TILE_SIZE * scale;
    const fittedHeight = (level.GRID_TOP + gridHeight * level.TILE_SIZE) * scale;
    expect(offsetX).toBeGreaterThanOrEqual(0);
    expect(offsetY).toBeGreaterThanOrEqual(0);
    expect(offsetX + fittedWidth).toBeLessThanOrEqual(960);
    expect(offsetY + fittedHeight).toBeLessThanOrEqual(540);
  }
});

test("launch starts horizontally at the configured global velocity", async () => {
  const app = await createApp();
  app.frame(1000);
  app.elements.launch.emit("click");
  app.frame(1040);
  const position = app.position();
  expect(position.x).toBe(96);
  expect(position.y).toBeGreaterThan(87);
  expect(position.y).toBeLessThan(88);
});

test("gravity affects the launched block without a global time scale", async () => {
  const app = await createApp();
  app.setSlider("gravity", 900);
  app.frame(1000);
  app.elements.launch.emit("click");
  app.frame(1040);
  expect(app.position().x).toBe(96);
  expect(app.position().y).toBeGreaterThan(87.5);
});

test("launch velocity controls the block's horizontal speed", async () => {
  const app = await createApp();
  app.setSlider("gravity", 0);
  app.setSlider("launchVelocity", 900);
  app.frame(1000);
  app.elements.launch.emit("click");
  app.frame(1040);
  expect(app.position().x).toBe(108);
});

test("platform acceleration changes velocity while the block rests on it", async () => {
  const startingRow = level.startCell.y;
  level.startCell.y = 2;
  try {
    const app = await createApp();
    app.select(24, 174);
    app.setSlider("acceleration", 900);
    app.select(24, 250);
    app.setSlider("gravity", 0);
    app.setSlider("launchVelocity", 100);
    app.frame(1000);
    app.elements.launch.emit("click");
    app.frame(1040);
    expect(app.position().x).toBeGreaterThan(76.4);
  } finally {
    level.startCell.y = startingRow;
  }
});

test("a fast launch detects the goal without tunneling through tiles", async () => {
  const startingRow = level.startCell.y;
  level.startCell.y = 9;
  try {
    const app = await createApp();
    app.setSlider("gravity", 0);
    app.setSlider("launchVelocity", 1200);
    app.frame(1000);
    app.elements.launch.emit("click");
    for (let time = 1016; time <= 1800; time += 16) {
      app.frame(time);
      if (app.elements.launch.disabled === false) break;
    }
    expect(app.elements["game-status"].textContent).toMatch(/Goal reached/);
  } finally {
    level.startCell.y = startingRow;
  }
});
