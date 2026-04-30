// P0-010 — admin commands for feature flags.

import { z } from 'zod';
import { requireAdmin, maybeUser } from '../auth.js';
import { recordAudit } from '../audit.js';
import { isEnabled, setFlag, listFlags } from '../flags.js';
import { invalidateAppConfigCache } from '../app-config.js';
import { CommandError, ErrorCode } from '../errors.js';

const SetSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z][a-z0-9_.-]*$/),
  enabled: z.boolean(),
  percent: z.number().int().min(0).max(100).optional(),
  allowlist: z.array(z.string().email()).max(200).optional(),
});

const KeySchema = z.object({ key: z.string().min(1).max(64) });

export const flagsCommands = {
  'flags.list': async ({ socket }) => {
    requireAdmin({ socket });
    return { rows: await listFlags() };
  },

  'flags.set': async ({ socket, payload }) => {
    const actor = requireAdmin({ socket });
    const parsed = SetSchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    await setFlag({ ...parsed.data, updatedBy: actor.id });
    invalidateAppConfigCache();
    await recordAudit({
      actorId: actor.id,
      action: 'flags.set',
      targetType: 'flag',
      targetId: parsed.data.key,
      metadata: { enabled: parsed.data.enabled, percent: parsed.data.percent ?? null },
    });
    return { ok: true };
  },

  // Anonymous-callable lookup so the client can branch on flags too.
  'flags.check': async ({ socket, payload }) => {
    const parsed = KeySchema.safeParse(payload);
    if (!parsed.success) throw new CommandError(ErrorCode.INVALID_PAYLOAD, 'invalid', parsed.error.issues);
    const user = maybeUser({ socket });
    return { key: parsed.data.key, enabled: await isEnabled(parsed.data.key, { user }) };
  },
};
