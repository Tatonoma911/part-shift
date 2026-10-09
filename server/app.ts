import { defineRoom, defineServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM } from '../src/net/protocol';
import { MatchRoom } from './MatchRoom';

export function createServer() {
  return defineServer({
    transport: new WebSocketTransport({ pingInterval: 5000, pingMaxRetries: 3 }),
    rooms: {
      [ROOM]: defineRoom(MatchRoom).filterBy(['mode', 'quick']),
    },
  });
}
