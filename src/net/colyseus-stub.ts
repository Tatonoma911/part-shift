// Stub for the artifact/preview build — online play is not available there.
export class Client {
  constructor(_url: string) {}
  async joinOrCreate(_room: string, _opts: unknown): Promise<never> { throw new Error('Online not available in preview'); }
  async join(_room: string, _opts: unknown): Promise<never> { throw new Error('Online not available in preview'); }
  async create(_room: string, _opts: unknown): Promise<never> { throw new Error('Online not available in preview'); }
}
export type Room = {
  state: unknown;
  leave(): void;
  onStateChange: unknown;
  onMessage: unknown;
  onError: unknown;
  onLeave: unknown;
};
