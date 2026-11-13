# Squarenaut: Build Outline

**Current state:** Phases 1 and 2 are complete. The editor can playtest a draft in the game, and the Daily button loads dated levels when available without changing the draft.

## Resolved Decisions

- **Water** is a medium that replaces Air in its cells. The block passes through it with modified behavior (viscosity and buoyancy), rather than colliding with it.
- The canvas has a fixed 960×540 viewport; the grid scales uniformly to fit it.
- Global Air controls are gravity and launch velocity; there is no global time scale.
- Water buoyancy is an upward acceleration that offsets gravity; when it exceeds gravity, the block accelerates upward. Water viscosity exponentially damps velocity.

## Phase 0: Setup

1. **Clear template and scaffold the app** (complete)
   - Remove template content.
   - Add a `<canvas>` element and a basic `main.ts` game loop.
   - Set the GitHub Pages `base` path in the Vite config.

## Phase 1: Playable Prototype (Hardcoded Level) (complete)

2. **Grid and renderer** (complete)
   - Draw a tile grid with blocky Canvas shapes for Platform, Water, Goal, and Hazard.

3. **Block and launch** (complete)
   - The Launch button sends the block horizontally, parallel to a flat platform.
   - Reset on fall-off, hazard hit, or Cancel.
   - Count launches.

4. **Goal and score** (complete)
   - Detect goal entry.
   - Show the launch count.

5. **Physics registry** (complete)
   - Define a `TileType` interface: `id`, a properties schema with defaults and ranges, and collision/behavior hooks.
   - Register Air as the global default.
   - Resolve per-instance values by flood-filling conjoined same-type tiles.

6. **Platform collision** (complete)
   - Acceleration changes tangential velocity over contact duration, with negative values reversing direction.
   - Acceleration is bounded from −900 to +900 units/s²; Bounciness sets the reflected height ratio from 0 to 2.

7. **Control panel** (complete)
   - Show one selected connected tile group, or global Air when an empty cell is selected (the default).
   - Auto-generate sliders from the selected type's property schema.
   - Adding a type should require no UI code.

## Phase 2: Content and Remaining Tile Types (complete)

8. **Level format and loader** (complete)
   - Define a JSON schema for grid, tiles, start, and goal.

9. **Level editor** (complete)
   - A separate page with a grid, tile palette, paint/erase, load/save/export JSON, and a Test button. Editor drafts are preserved in session storage when navigating to the game.

10. **Water tile** (complete)
    - A non-solid medium that replaces Air in its cells.
    - Properties: viscosity (drag) and buoyancy. Buoyancy offsets gravity and can make the block float upward.
    - Registered like Platform.

11. **Air globals** (complete)
    - Gravity and launch velocity.
    - Exposed in the control panel.

## Phase 3: Daily Loop

12. **Daily map** (loader complete; level content pending)
    - Store dated level files as `public/levels/daily/YYYY-MM-DD.json`; Vite serves them at `levels/daily/YYYY-MM-DD.json` under the app's base path.
    - The Daily button fetches the current UTC date's file and shows a message if it is missing, leaving the current game and editor draft intact.
    - No daily level files are currently supplied.

13. **Scorecard**
    - Generate text plus a canvas image (date, launches, par/result).
    - Share via `navigator.share` or clipboard.

14. **Deploy**
    - GitHub Actions workflow that builds Vite and publishes to GitHub Pages.

## Phase 4: Backlog

- Local best-score storage
- More tile types
- Sound
- Animations
- In-editor physics preview
- Par values per level
