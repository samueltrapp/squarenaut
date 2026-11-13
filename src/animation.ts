import { drawMap, type GameMap } from "./map";
import type { PhysicsSimulation } from "./physics";
import type { TileRegion } from "./tiles";

export function startAnimation(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  getGame: () => { map: GameMap; physics: PhysicsSimulation },
  getSelectedRegion: () => TileRegion | undefined,
): void {
  let previousFrameTime = 0;

  function drawBlock(physics: PhysicsSimulation): void {
    const { block } = physics;
    const half = block.size / 2;
    context.fillStyle = "#f3c86a";
    context.fillRect(block.x - half, block.y - half, block.size, block.size);
    context.fillStyle = "#684d27";
    context.fillRect(block.x - 7, block.y - 5, 4, 4);
    context.fillRect(block.x + 3, block.y - 5, 4, 4);
    context.fillRect(block.x - 5, block.y + 5, 10, 3);
  }

  function frame(timestamp: number): void {
    const { map, physics } = getGame();
    const deltaSeconds =
      previousFrameTime === 0 ? 0 : Math.min((timestamp - previousFrameTime) / 1000, 0.04);
    previousFrameTime = timestamp;
    physics.update(deltaSeconds);

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(
      map.viewport.scale,
      0,
      0,
      map.viewport.scale,
      map.viewport.offsetX,
      map.viewport.offsetY,
    );
    drawMap(context, map, getSelectedRegion());
    drawBlock(physics);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
