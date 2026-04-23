import { io } from 'socket.io-client';

// Thin wrapper around socket.io that speaks the project's two-way command
// protocol. There is no REST surface; every client↔server interaction uses
// a single "command" event of shape { id, name, payload }.
//
// Public API:
//   socket.send(name, payload?)                    — fire-and-forget
//   socket.request(name, payload?, { onMessage })  — returns Promise<result>,
//                                                    forwards .progress frames
//   socket.on(name, fn)                            — global listener
//   socket.onConnect(fn) / socket.onDisconnect(fn)
export class SocketClient {
  constructor({ url } = {}) {
    this.socket = io(url || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    this._pending = new Map();
    this._listeners = new Map();
    this._connectHooks = new Set();
    this._disconnectHooks = new Set();

    this.socket.on('connect', () => this._connectHooks.forEach((fn) => fn()));
    this.socket.on('disconnect', (reason) => this._disconnectHooks.forEach((fn) => fn(reason)));

    this.socket.on('command', (msg) => {
      if (!msg || typeof msg.name !== 'string') return;
      const { id, name, payload } = msg;
      if (id && this._pending.has(id)) {
        const entry = this._pending.get(id);
        if (name === entry.resultName) {
          this._pending.delete(id);
          entry.resolve(payload);
          return;
        }
        if (name === entry.errorName) {
          this._pending.delete(id);
          entry.reject(new Error(payload?.error || 'command_error'));
          return;
        }
        if (entry.onMessage) entry.onMessage(name, payload);
      }
      const set = this._listeners.get(name);
      if (set) for (const fn of set) fn(payload, msg);
    });
  }

  get connected() {
    return this.socket.connected;
  }

  send(name, payload = {}) {
    this.socket.emit('command', { name, payload });
  }

  request(name, payload = {}, opts = {}) {
    const id =
      (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
        ? globalThis.crypto.randomUUID()
        : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve, reject) => {
      this._pending.set(id, {
        resultName: `${name}.result`,
        errorName: `${name}.error`,
        onMessage: opts.onMessage,
        resolve,
        reject,
      });
      this.socket.emit('command', { id, name, payload });
    });
  }

  on(name, fn) {
    if (!this._listeners.has(name)) this._listeners.set(name, new Set());
    this._listeners.get(name).add(fn);
    return () => this._listeners.get(name)?.delete(fn);
  }

  onConnect(fn) { this._connectHooks.add(fn); return () => this._connectHooks.delete(fn); }
  onDisconnect(fn) { this._disconnectHooks.add(fn); return () => this._disconnectHooks.delete(fn); }
}
