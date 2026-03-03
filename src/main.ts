import { createGame, updateGame, Game } from './game';
import { createInputState, setupInput } from './input';
import { initRenderer, resize, render } from './renderer';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const input = createInputState();

const { scale: s, offsetX: ox, offsetY: oy } = initRenderer(canvas);
input.worldScale = s;
input.worldOffsetX = ox;
input.worldOffsetY = oy;
input.canvasRect = canvas.getBoundingClientRect();

setupInput(canvas, input);

window.addEventListener('resize', () => {
  const info = resize();
  input.worldScale = info.scale;
  input.worldOffsetX = info.offsetX;
  input.worldOffsetY = info.offsetY;
  input.canvasRect = canvas.getBoundingClientRect();
});

const game: Game = createGame(input);

// Fixed timestep
const FIXED_DT = 1 / 60;
let accumulator = 0;
let lastTime = 0;

function loop(time: number): void {
  try {
    if (lastTime === 0) lastTime = time;
    let frameDt = (time - lastTime) / 1000;
    lastTime = time;

    // Clamp to avoid spiral of death
    if (frameDt > 0.1) frameDt = 0.1;

    accumulator += frameDt;

    while (accumulator >= FIXED_DT) {
      updateGame(game, FIXED_DT);
      accumulator -= FIXED_DT;
    }

    render(game);
  } catch (e) {
    console.error('Game loop crash:', e);
    document.body.style.background = '#200';
    document.body.innerHTML = `<pre style="color:#f88;padding:20px;font-size:16px">CRASH: ${e}\n\n${(e as Error).stack}</pre>`;
    return; // stop the loop
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
