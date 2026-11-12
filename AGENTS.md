# Squarenaut

Squarenaut is a browser-based physics puzzle built with TypeScript, Vite, and the Canvas 2D API. The current prototype uses a hardcoded grid where players launch a block toward a goal, avoid hazards, and tune connected tile-group physics. The project outline in `OUTLINE.md` describes planned features and later phases.

## Current status

- Phase 1 is playable with a hardcoded 30×20 level, a fixed 960×540 canvas, and a grid that scales uniformly to fit that viewport.
- Desktop, tablet, and mobile layouts are supported by responsive breakpoints in `src/style.css`.
- Global Air controls are Gravity and Launch velocity; there is no global Time scale.
- Connected Platform groups expose Acceleration (−900 to +900 units/s², default 0) and Bounciness. Acceleration changes tangential velocity over time while contact is maintained.
- Tests run with Vitest via `npm test`; `npm run build` type-checks and builds the app.
- Level loading/editing, Water physics, daily levels, scorecards, and deployment remain planned; see `OUTLINE.md`.

When an important implementation change alters this status or a planned milestone, update this section and the corresponding progress in `OUTLINE.md`.

## Project layout

- `index.html` contains the game interface and canvas.
- `src/main.ts` runs the game loop, rendering, controls, and collision handling.
- `src/tiles.ts` defines the tile registry, property schemas, and connected tile regions.
- `src/level.ts` defines the current grid dimensions, start cell, and hardcoded tiles.
- `src/style.css` contains the responsive interface styling.
- `vite.config.ts` configures Vite, including the GitHub Pages base path.

## Code style

- Use TypeScript for application logic and preserve the compiler's strict checks.
- End TypeScript and JavaScript statements and declarations with semicolons; use semicolons between interface and type members as well.
- Use single quotes for TypeScript and JavaScript strings unless escaping or interpolation makes another form clearer.
- Indent with two spaces, use descriptive `camelCase` names for values and functions, and `PascalCase` for types.
- Keep tile behavior and editable properties in the tile registry so new tile types can reuse the generated controls.
- Keep styles in `src/style.css` and follow the existing responsive layout patterns.
