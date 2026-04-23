import { logger } from '../logger.js';
import { designsCommands } from './designs.js';
import { ordersCommands } from './orders.js';
import { accountCommands } from './account.js';
import { stlCommands } from './stl.js';
import { paymentsCommands } from './payments.js';

// Two-way command pattern over a single "command" socket event.
//
//   Client → Server:   { id, name, payload }
//   Server → Client:   { id, name: "<name>.result" | "<name>.error" | "<name>.progress", payload }
//
// The `id` correlates a request with its responses. The server can also push
// unsolicited commands by omitting `id`. No REST endpoints exist.
export function initCommandRegistry() {
  return Object.freeze({
    ...designsCommands,
    ...ordersCommands,
    ...accountCommands,
    ...stlCommands,
    ...paymentsCommands,
  });
}

export async function dispatchCommand(registry, socket, msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, name, payload } = msg;
  if (typeof name !== 'string') {
    socket.emit('command', { id, name: 'protocol.error', payload: { error: 'missing_name' } });
    return;
  }
  const handler = registry[name];
  if (!handler) {
    socket.emit('command', { id, name: `${name}.error`, payload: { error: 'unknown_command' } });
    logger.warn({ msg: 'cmd.unknown', name, id });
    return;
  }
  const started = Date.now();
  try {
    const result = await handler({ socket, payload: payload ?? {}, id });
    socket.emit('command', {
      id,
      name: `${name}.result`,
      payload: result === undefined ? null : result,
    });
    logger.info({ msg: 'cmd.ok', name, id, ms: Date.now() - started });
  } catch (err) {
    socket.emit('command', {
      id,
      name: `${name}.error`,
      payload: { error: err.message || 'internal_error' },
    });
    logger.error({ msg: 'cmd.error', name, id, ms: Date.now() - started, err: err.message });
  }
}
