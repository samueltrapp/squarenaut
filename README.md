# Squarenaut

Squarenaut is a physics puzzle: launch the block, guide it through the level, and reach the green goal without hitting hazards or falling off the grid.

## How to play

1. Adjust the physics controls if you like, then press **Launch**. The block starts with a horizontal push; gravity and the level's tiles affect its path.
2. Reach the **Goal** (green) to finish. Avoid **Hazards** (red) and keep the block inside the level. A failed or canceled launch returns the block to the start.
3. Try again with different settings or a new approach. The launch counter tracks attempts for the current level.

Click an empty cell to edit the global **Air** settings:

- **Gravity** controls how strongly the block accelerates downward.
- **Launch velocity** controls its initial horizontal speed.

Click a tile to edit its connected group. Connected tiles of the same kind share settings:

- **Platform** is solid. **Bounciness** changes how strongly the block bounces on contact; **Acceleration** speeds it up or slows it down along a surface while it remains in contact.
- **Water** is pass-through. **Viscosity** slows the block, and **Buoyancy** pushes it upward while submerged.
- **Goal** completes the level; **Hazard** ends the attempt.

## Daily puzzle

Press **Daily** to try the puzzle for the current UTC date. When a daily level is available, completing it shows a scorecard with your date and launch count, plus a par result if the level provides a par. Use **Share scorecard** to share it or copy the result. If no daily level is available, the game tells you and leaves your current level unchanged.

## Make and test a level

Open **Level editor** to paint or erase platforms, water, and hazards, and place the start and goal. Click or drag on the grid to use the selected tool. Use **Test** to play the draft, **Save locally** to keep it in this browser, or **Export JSON** to save a file you can load again later.
