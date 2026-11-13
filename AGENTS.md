# Squarenaut

Squarenaut is a browser-based physics puzzle built with TypeScript, Vite, and the Canvas 2D API. Players launch a block toward a goal, avoid hazards, and tune connected tile-group physics. Levels use a validated JSON format, and a separate browser-based editor supports creating and exporting levels.

## Current status

- Phases 1 and 2 are complete. The default 30×20 level is loaded from `levels/default.json`; the fixed 960×540 game canvas scales the grid uniformly to fit.
- Desktop, tablet, and mobile layouts are supported by responsive breakpoints in `src/style.css`.
- Global Air controls are Gravity and Launch velocity; there is no global Time scale.
- Connected Platform groups expose Acceleration (−900 to +900 units/s², default 0) and Bounciness. Acceleration changes tangential velocity over time while contact is maintained.
- Connected Water groups expose Viscosity (velocity drag) and Buoyancy (upward acceleration that offsets gravity).
- `editor.html` provides a separate level editor with a Test button; its draft survives navigation to the game in session storage. `schemas/level.schema.json` describes the level JSON format, and the game validates loaded levels before use.
- Daily loads `public/levels/daily/YYYY-MM-DD.json` using the current UTC date. Daily wins produce a shareable scorecard; optional level par values are validated and included. No daily level content is supplied yet.
- `.github/workflows/deploy.yml` runs tests and builds before deploying to GitHub Pages.
- Tests run with Vitest via `npm test`; `npm run build` type-checks and builds the app.
- Daily level content remains planned; see `OUTLINE.md`.

When an important implementation change alters this status or a planned milestone, update this section and the corresponding progress in `OUTLINE.md`.

## Project layout

- `index.html` contains the game interface and canvas.
- `src/main.ts` runs the game loop, rendering, controls, and collision handling.
- `src/tiles.ts` defines the tile registry, property schemas, and connected tile regions.
- `levels/default.json` contains the shipped level; `src/level-format.ts` validates and serializes levels.
- `editor.html` and `src/editor.ts` implement the separate level editor.
- `src/level.ts` defines shared grid sizing and loads the default level.
- `src/style.css` contains the responsive interface styling.
- `vite.config.ts` configures Vite, including the GitHub Pages base path.

## Code style

- Use TypeScript for application logic and preserve the compiler's strict checks.
- End TypeScript and JavaScript statements and declarations with semicolons; use semicolons between interface and type members as well.
- Use single quotes for TypeScript and JavaScript strings unless escaping or interpolation makes another form clearer.
- Indent with two spaces, use descriptive `camelCase` names for values and functions, and `PascalCase` for types.
- Keep tile behavior and editable properties in the tile registry so new tile types can reuse the generated controls.
- Keep styles in `src/style.css` and follow the existing responsive layout patterns.
