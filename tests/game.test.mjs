import { readFile } from "node:fs/promises";
import { transformWithOxc } from "vite";
import { expect, test } from "vitest";

async function moduleUrl(path, dependencies = {}) {
  let source = await readFile(new URL(path, import.meta.url), "utf8");
  source = source.replace(/import ['"]\.\/style\.css['"];/, "");
  const { code } = await transformWithOxc(source, path);
  const linkedCode = Object.entries(dependencies).reduce(
    (result, [specifier, url]) => result.replaceAll(`from "${specifier}"`, `from "${url}"`),
    code,
  );
  return `data:text/javascript;base64,${Buffer.from(linkedCode).toString("base64")}`;
}

const tilesUrl = await moduleUrl("../src/tiles.ts");
const tiles = await import(tilesUrl);
const levelData = JSON.parse(
  await readFile(new URL("../levels/default.json", import.meta.url), "utf8"),
);
const levelDataUrl = `data:text/javascript;base64,${Buffer.from(
  `export default ${JSON.stringify(levelData)};`,
).toString("base64")}`;
const levelFormatUrl = await moduleUrl("../src/level-format.ts", { "./tiles": tilesUrl });
const levelFormat = await import(levelFormatUrl);
const levelSessionUrl = await moduleUrl("../src/level-session.ts", {
  "./level-format": levelFormatUrl,
});
const scorecardUrl = await moduleUrl("../src/scorecard.ts");
const scorecard = await import(scorecardUrl);
const levelUrl = await moduleUrl("../src/level.ts", {
  "../levels/default.json": levelDataUrl,
  "./level-format": levelFormatUrl,
});
const level = await import(levelUrl);
const { fitGridToViewport } = level;
const mainSource = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");
const mapUrl = await moduleUrl("../src/map.ts", { "./level": levelUrl, "./tiles": tilesUrl });
const physicsUrl = await moduleUrl("../src/physics.ts", { "./map": mapUrl, "./tiles": tilesUrl });
const animationUrl = await moduleUrl("../src/animation.ts", {
  "./map": mapUrl,
  "./physics": physicsUrl,
  "./tiles": tilesUrl,
});
const editorUrl = await moduleUrl("../src/editor.ts", {
  "./level": levelUrl,
  "./level-format": levelFormatUrl,
  "./level-session": levelSessionUrl,
  "./tiles": tilesUrl,
});
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
    return this.listeners.get(type)?.(event);
  }
}

async function createEditor(storage) {
  const ids = [
    "editor-canvas",
    "grid-width",
    "grid-height",
    "resize-grid",
    "load-level",
    "editor-status",
    "save-level",
    "load-saved",
    "export-level",
    "test-level",
    "back-to-game",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  const tools = ["platform", "water", "hazard", "start", "goal", "erase"].map((tool) => {
    const element = new Element();
    element.dataset = { tool };
    element.classList = { add() {}, remove() {} };
    return element;
  });
  const canvas = elements["editor-canvas"];
  canvas.getContext = () => ({
    setTransform() {},
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    strokeRect() {},
    arc() {},
  });
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: canvas.width,
    height: canvas.height,
  });
  canvas.setPointerCapture = () => {};
  const local = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.localStorage = {
    getItem: (key) => local.get(key) ?? null,
    setItem: (key, value) => local.set(key, value),
  };
  globalThis.document = {
    baseURI: "http://localhost/squarenaut/editor.html",
    querySelector: (selector) => elements[selector.slice(1)],
    querySelectorAll: () => tools,
    createElement: () => new Element(),
  };
  let destination;
  globalThis.window = {
    location: {
      assign: (url) => {
        destination = String(url);
      },
    },
  };
  await import(`${editorUrl}#${appNumber++}`);
  return {
    elements,
    tools,
    local,
    destination: () => destination,
    paint(x, y) {
      canvas.emit("pointerdown", { clientX: x * 48 + 24, clientY: y * 48 + 30, pointerId: 1 });
      canvas.emit("pointerup");
    },
  };
}

async function createApp({
  href = "http://localhost/squarenaut/index.html",
  storage = new Map(),
  fetchLevel,
} = {}) {
  const elements = Object.fromEntries(
    [
      "game",
      "launch",
      "cancel",
      "daily",
      "launch-count",
      "game-status",
      "physics-controls",
      "daily-scorecard",
      "scorecard-text",
      "scorecard-image",
      "share-scorecard",
    ].map((id) => [id, new Element()]),
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
    fillText() {},
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
    baseURI: href,
    querySelector: (selector) => elements[selector.slice(1)],
    createElement: () => {
      const scorecardCanvas = new Element();
      scorecardCanvas.getContext = () => ({ ...context, canvas: scorecardCanvas });
      scorecardCanvas.toDataURL = () => "data:image/png;base64,c2NvcmVjYXJk";
      scorecardCanvas.toBlob = (callback) =>
        callback(new Blob(["scorecard"], { type: "image/png" }));
      return scorecardCanvas;
    },
  };
  globalThis.sessionStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  };
  globalThis.window = {
    location: { href },
    history: {
      replaceState: (_state, _title, url) => {
        globalThis.window.location.href = String(url);
      },
    },
  };
  if (fetchLevel) globalThis.fetch = fetchLevel;
  let nextFrame;
  globalThis.requestAnimationFrame = (callback) => {
    nextFrame = callback;
  };
  const source = mainSource
    .replace('import "./style.css";', "")
    .replace('from "./animation"', `from "${animationUrl}"`)
    .replace(/from ["']\.\/level-format["']/, `from "${levelFormatUrl}"`)
    .replace(/from ["']\.\/level-session["']/, `from "${levelSessionUrl}"`)
    .replace(/from ["']\.\/scorecard["']/, `from "${scorecardUrl}"`)
    .replace('from "./map"', `from "${mapUrl}"`)
    .replace('from "./physics"', `from "${physicsUrl}"`)
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
  expect(app.slider("viscosity").value).toBe("2.4");
  expect(app.slider("buoyancy").value).toBe("600");
  expect(app.elements["physics-controls"].children.length).toBe(1);
});

test("level loader validates cells and rejects duplicate occupied tiles", () => {
  const valid = {
    grid: { width: 4, height: 3 },
    start: { x: 0, y: 0 },
    goal: { x: 3, y: 2 },
    tiles: [{ x: 1, y: 1, typeId: "water" }],
  };
  expect(levelFormat.loadLevel(valid)).toEqual(valid);
  expect(() =>
    levelFormat.loadLevel({
      ...valid,
      tiles: [
        { x: 1, y: 1, typeId: "water" },
        { x: 1, y: 1, typeId: "platform" },
      ],
    }),
  ).toThrow(/More than one tile/);
  expect(() => levelFormat.loadLevel({ ...valid, goal: { x: 4, y: 2 } })).toThrow(
    /inside the grid/,
  );
});

test("daily par is validated, retained, and reflected in scorecard results", () => {
  const valid = {
    grid: { width: 4, height: 3 },
    start: { x: 0, y: 0 },
    goal: { x: 3, y: 2 },
    tiles: [],
    par: 4,
  };
  expect(levelFormat.loadLevel(valid)).toEqual(valid);
  expect(levelFormat.serializeLevel(levelFormat.loadLevel(valid))).toEqual(valid);
  expect(() => levelFormat.loadLevel({ ...valid, par: 0 })).toThrow(
    /Par must be a positive integer/,
  );
  expect(scorecard.formatScorecard({ date: "2026-11-13", launches: 2, par: 4 })).toContain(
    "2 under par",
  );
  expect(scorecard.formatScorecard({ date: "2026-11-13", launches: 4, par: 4 })).toContain(
    "on par",
  );
  expect(scorecard.formatScorecard({ date: "2026-11-13", launches: 5, par: 4 })).toContain(
    "1 over par",
  );
});

test("scorecard sharing copies its text when native sharing is unavailable", async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copiedText;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (text) => {
          copiedText = text;
        },
      },
    },
  });
  try {
    const result = await scorecard.shareScorecard(
      {},
      {
        date: "2026-11-13",
        launches: 3,
        par: 2,
      },
    );
    expect(result).toBe("copied");
    expect(copiedText).toContain("1 over par");
  } finally {
    if (originalNavigator) {
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    } else {
      delete globalThis.navigator;
    }
  }
});

test("editor test and daily switching preserve the editor draft", async () => {
  const storage = new Map();
  const editor = await createEditor(storage);
  editor.tools.find((tool) => tool.dataset.tool === "water").emit("click");
  editor.paint(0, 0);
  editor.elements["test-level"].emit("click");
  expect(editor.destination()).toBe("http://localhost/squarenaut/index.html?playtest=1");
  const draft = JSON.parse(storage.get("squarenaut-editor-draft"));
  expect(draft.tiles).toContainEqual({ x: 0, y: 0, typeId: "water" });

  const dailyLevel = {
    grid: { width: 4, height: 3 },
    start: { x: 2, y: 1 },
    goal: { x: 3, y: 2 },
    tiles: [],
  };
  let requestedUrl;
  const app = await createApp({
    href: editor.destination(),
    storage,
    fetchLevel: async (url) => {
      requestedUrl = String(url);
      return {
        status: 200,
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => dailyLevel,
      };
    },
  });
  expect(app.elements["game-status"].textContent).toMatch(/Editor playtest/);
  app.frame(1000);
  expect(app.position()).toEqual({ x: 72, y: 87 });
  app.select(24, 30);
  expect(app.section().children[0].textContent).toMatch(/Water/);
  app.elements.launch.emit("click");
  app.frame(1040);
  expect(app.elements["launch-count"].textContent).toBe("1");
  app.elements.daily.emit("click");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requestedUrl).toBe(
    `http://localhost/squarenaut/levels/daily/${new Date().toISOString().slice(0, 10)}.json`,
  );
  expect(app.elements["game-status"].textContent).toMatch(/Daily level/);
  expect(app.elements["launch-count"].textContent).toBe("0");
  expect(app.elements.cancel.disabled).toBe(true);
  expect(app.section().children[0].textContent).toBe("Air · Global");
  expect(window.location.href).not.toContain("playtest");
  app.frame(1080);
  expect(app.position()).toEqual({ x: 120, y: 87 });
  expect(JSON.parse(storage.get("squarenaut-editor-draft"))).toEqual(draft);

  const restored = await createEditor(storage);
  expect(restored.elements["editor-status"].textContent).toMatch(/draft restored/i);
  restored.elements["save-level"].emit("click");
  expect(JSON.parse(restored.local.get("squarenaut-level"))).toEqual(draft);
});

test("unavailable daily level leaves the current playtest and editor draft intact", async () => {
  const draft = { ...levelData, start: { x: 4, y: 1 } };
  const storage = new Map([["squarenaut-editor-draft", JSON.stringify(draft)]]);
  const app = await createApp({
    href: "http://localhost/squarenaut/index.html?playtest=1",
    storage,
    fetchLevel: async () => ({ status: 404, ok: false }),
  });
  app.elements.daily.emit("click");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(app.elements["game-status"].textContent).toMatch(/No daily level is available/);
  expect(app.elements.daily.disabled).toBe(false);
  app.frame(1000);
  expect(app.position()).toEqual({ x: 216, y: 87 });
  expect(JSON.parse(storage.get("squarenaut-editor-draft"))).toEqual(draft);
  expect(window.location.href).toContain("playtest=1");
});

test("back to game saves an edited draft and a broken playtest reports an error", async () => {
  const storage = new Map();
  const editor = await createEditor(storage);
  editor.tools.find((tool) => tool.dataset.tool === "hazard").emit("click");
  editor.paint(0, 0);
  let prevented = false;
  editor.elements["back-to-game"].emit("click", {
    preventDefault: () => {
      prevented = true;
    },
  });
  expect(prevented).toBe(false);
  expect(JSON.parse(storage.get("squarenaut-editor-draft")).tiles).toContainEqual({
    x: 0,
    y: 0,
    typeId: "hazard",
  });

  storage.set("squarenaut-editor-draft", "{broken");
  const app = await createApp({
    href: "http://localhost/squarenaut/index.html?playtest=1",
    storage,
    fetchLevel: async () => ({
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({}),
    }),
  });
  expect(app.elements["game-status"].textContent).toMatch(/Could not load the editor playtest/);
  app.elements.daily.emit("click");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(app.elements["game-status"].textContent).toMatch(/grid object/);
  app.frame(1000);
  expect(app.position()).toEqual({ x: 72, y: 87 });
  expect(storage.get("squarenaut-editor-draft")).toBe("{broken");
});

test("daily reports missing files when a development server returns its HTML fallback", async () => {
  const app = await createApp({
    fetchLevel: async () => ({
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
    }),
  });
  app.elements.daily.emit("click");
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(app.elements["game-status"].textContent).toMatch(/No daily level is available/);
});

test("clearing a daily level creates a scorecard with an image and par result", async () => {
  const dailyLevel = {
    grid: { width: 30, height: 20 },
    start: { x: 4, y: 9 },
    goal: { x: 26, y: 9 },
    tiles: [],
    par: 2,
  };
  const app = await createApp({
    fetchLevel: async () => ({
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => dailyLevel,
    }),
  });
  app.elements.daily.emit("click");
  await new Promise((resolve) => setTimeout(resolve, 0));
  app.setSlider("gravity", 0);
  app.setSlider("launchVelocity", 1200);
  app.frame(1000);
  app.elements.launch.emit("click");
  for (let time = 1016; time <= 2200; time += 16) {
    app.frame(time);
    if (!app.elements.launch.disabled) break;
  }
  expect(app.elements["game-status"].textContent).toMatch(/Goal reached/);
  expect(app.elements["daily-scorecard"].hidden).toBe(false);
  expect(app.elements["scorecard-text"].textContent).toContain("Par 2");
  expect(app.elements["scorecard-image"].src).toMatch(/^data:image\/png/);
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

test("water buoyancy offsets gravity and viscosity damps horizontal motion", async () => {
  const startingCell = { ...level.startCell };
  const waterTile = level.defaultLevel.tiles.find((tile) => tile.typeId === "water");
  const waterY = waterTile.y;
  level.startCell.x = 9;
  level.startCell.y = 8;
  waterTile.y = 8;
  try {
    const app = await createApp();
    app.setSlider("gravity", 0);
    app.setSlider("launchVelocity", 900);
    app.select(456, 414);
    app.setSlider("buoyancy", 1200);
    app.setSlider("viscosity", 8);
    app.frame(1000);
    app.elements.launch.emit("click");
    app.frame(1040);
    expect(app.position().x).toBeLessThan(456 + 36);
    expect(app.position().y).toBeLessThan(423);

    const sinkingApp = await createApp();
    sinkingApp.setSlider("gravity", 450);
    sinkingApp.setSlider("launchVelocity", 900);
    sinkingApp.select(456, 414);
    sinkingApp.setSlider("buoyancy", 300);
    sinkingApp.setSlider("viscosity", 0);
    sinkingApp.frame(1000);
    sinkingApp.elements.launch.emit("click");
    sinkingApp.frame(1040);
    expect(sinkingApp.position().y).toBeGreaterThan(423);
  } finally {
    level.startCell.x = startingCell.x;
    level.startCell.y = startingCell.y;
    waterTile.y = waterY;
  }
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
