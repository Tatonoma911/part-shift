/**
 * Everything a player can do, as plain data. Input code and (later) the
 * multiplayer server both go through World.apply(), so a command can be sent
 * over the network as JSON and replayed on the authoritative simulation.
 */
export type Command =
  | { type: 'placeCore'; x: number; y: number }
  | { type: 'queueDig'; x: number; y: number }
  | { type: 'cancelDig'; x: number; y: number }
  | { type: 'toggleMark'; x: number; y: number };
