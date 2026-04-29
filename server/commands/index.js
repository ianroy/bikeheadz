import { logger } from '../logger.js';
import { CommandError, ErrorCode } from '../errors.js';
import { captureException } from '../sentry.js';
import { designsCommands } from './designs.js';
import { ordersCommands } from './orders.js';
import { accountCommands } from './account.js';
import { stlCommands } from './stl.js';
import { paymentsCommands } from './payments.js';
import { authCommands } from './auth.js';
import { adminCommands } from './admin.js';
import { flagsCommands } from './flags.js';
import { photosCommands } from './photos.js';

// Two-way command pattern over a single "command" socket event.
//
//   Client → Server:   { id, name, payload }
//   Server → Client:   { id, name: "<name>.result" | "<name>.error" | "<name>.progress", payload }
//
// The `id` correlates a request with its responses. The server can also push
// unsolicited commands by omitting `id`. No REST endpoints exist (modulo a
// few opt-in ops surfaces — see ProductSpec §11).
export function initCommandRegistry() {
  return Object.freeze({
    ...authCommands,
    ...designsCommands,
    ...ordersCommands,
    ...accountCommands,
    ...stlCommands,
    ...paymentsCommands,
    ...adminCommands,
    ...flagsCommands,
    ...photosCommands,
  });
}

export async function dispatchCommand(registry, socket, msg) {
  if (!msg || typeof msg !== 'object') return;
  const { id, name, payload } = msg;
  if (typeof name !== 'string') {
    socket.emit('command', {
      id,
      name: 'protocol.error',
      payload: new CommandError(ErrorCode.INVALID_PAYLOAD, 'missing_name').toFrame(),
    });
    return;
  }
  const handler = registry[name];
  if (!handler) {
    socket.emit('command', {
      id,
      name: `${name}.error`,
      payload: new CommandError(ErrorCode.UNKNOWN_COMMAND, `unknown_command: ${name}`).toFrame(),
    });
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
    const cmdErr =
      err instanceof CommandError
        ? err
        : new CommandError(mapLegacyMessage(err.message), err.message || 'internal_error');
    socket.emit('command', {
      id,
      name: `${name}.error`,
      payload: cmdErr.toFrame(),
    });
    logger.error({
      msg: 'cmd.error',
      name,
      id,
      ms: Date.now() - started,
      code: cmdErr.code,
      err: cmdErr.message,
    });
    captureException(err, { tags: { command: name }, extra: { id } });
  }
}

// Best-effort mapping for legacy `throw new Error('foo')` callsites that
// haven't been migrated to CommandError yet. Falls through to internal_error
// so an unfamiliar string never accidentally exposes internals to the client
// while still giving the client *something* to branch on.
function mapLegacyMessage(message) {
  if (!message) return ErrorCode.INTERNAL_ERROR;
  for (const code of Object.values(ErrorCode)) {
    if (message === code) return code;
  }
  return ErrorCode.INTERNAL_ERROR;
}
