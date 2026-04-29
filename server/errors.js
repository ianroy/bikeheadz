// Canonical machine-readable error codes shared across the socket.io
// command surface. Every `*.error` frame should carry one of these in
// `payload.code` so the client can branch on intent rather than
// string-match `err.message`.
//
// Mirror this list (when expanded) into the Python worker's
// `pipeline/errors.py::ErrorCode` enum so worker-emitted errors flow
// through unchanged.
export const ErrorCode = Object.freeze({
  // Auth / session
  AUTH_REQUIRED: 'auth_required',
  FORBIDDEN_ADMIN_ONLY: 'forbidden_admin_only',
  INVALID_TOKEN: 'invalid_token',
  TOKEN_EXPIRED: 'token_expired',

  // Input validation
  INVALID_PAYLOAD: 'invalid_payload',
  IMAGE_REQUIRED: 'image_required',
  IMAGE_TOO_LARGE: 'image_too_large',
  UNSUPPORTED_IMAGE: 'unsupported_image_encoding',
  UNSAFE_IMAGE: 'unsafe_image',
  MINOR_LIKENESS: 'minor_likeness',
  NO_FACE_DETECTED: 'no_face_detected',

  // Rate limiting
  RATE_LIMITED: 'rate_limited',

  // Payment
  PAYMENT_REQUIRED: 'payment_required',
  STRIPE_NOT_CONFIGURED: 'stripe_not_configured',
  PROMO_INVALID: 'promo_invalid',
  PROMO_EXHAUSTED: 'promo_exhausted',

  // Resource state
  DESIGN_NOT_FOUND: 'design_not_found',
  DESIGN_EXPIRED: 'design_expired',
  PHOTO_NOT_FOUND: 'photo_not_found',

  // Backend / GPU
  RUNPOD_NO_RESULT: 'runpod_no_result',
  RUNPOD_UNREACHABLE: 'runpod_unreachable',
  WORKER_FAILED: 'worker_failed',

  // Catch-all
  INTERNAL_ERROR: 'internal_error',
  UNKNOWN_COMMAND: 'unknown_command',
});

// Codes whose retryable attribute is `true`. Everything else is a hard fail
// the user has to act on (re-upload, re-pay, re-auth).
const RETRYABLE = new Set([
  ErrorCode.RATE_LIMITED,
  ErrorCode.RUNPOD_UNREACHABLE,
  ErrorCode.RUNPOD_NO_RESULT,
  ErrorCode.WORKER_FAILED,
  ErrorCode.INTERNAL_ERROR,
]);

export function isRetryable(code) {
  return RETRYABLE.has(code);
}

// Lightweight error class so handlers can throw with a structured shape that
// `dispatchCommand` will pick up. `details` is optional and free-form (used
// by zod validation to attach issue arrays, by rate-limit to attach
// retryAfter, etc.).
export class CommandError extends Error {
  constructor(code, message, details = null) {
    super(message || code);
    this.name = 'CommandError';
    this.code = code;
    this.details = details;
    this.retryable = isRetryable(code);
  }

  toFrame() {
    return {
      error: this.code, // legacy field (kept for back-compat with current clients)
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
