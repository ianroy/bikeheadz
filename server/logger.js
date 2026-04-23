// 12-factor §11 — treat logs as event streams. Structured JSON lines to stdout/stderr.
const LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function emit(level, payload) {
  if ((LEVELS[level] ?? 2) > (LEVELS[LEVEL] ?? 2)) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, ...payload });
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

export const logger = {
  error: (p) => emit('error', p),
  warn: (p) => emit('warn', p),
  info: (p) => emit('info', p),
  debug: (p) => emit('debug', p),
};
