/**
 * Part Shift match server. Local: `npm run server` (port 2567) next to
 * `npm run dev`; the dev build connects to it by itself (docs/MULTIPLAYER.md).
 */
import { createServer } from './app';

const port = Number(process.env.PORT ?? 2567);
createServer()
  .listen(port)
  .then(() => console.log(`Part Shift server on :${port}`));
