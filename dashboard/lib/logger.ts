/**
 * Structured logger for server-side code (API routes + server
 * components + cron handlers).
 *
 * Why: ad-hoc `console.log` lines aren't queryable, don't aggregate
 * across requests, and ship PII at random. Replacing them with one
 * function that emits structured JSON in production gives us:
 *   - filterable scope + level on every line (Vercel Logs supports
 *     JSON queries; Sentry breadcrumbs pick up the structure too)
 *   - consistent shape so a request can be traced end-to-end
 *   - PII scrubbing at the source — emails are partially redacted,
 *     known credential keys are stripped before anything hits stdout
 *
 * Output format:
 *   production  → single-line JSON: {"ts","level","scope","msg",...ctx}
 *   development → pretty: [level] [scope] message { ctx as JSON }
 *
 * Error objects auto-expand: pass `{ err }` and the logger pulls
 * { name, message, stack } so you don't have to remember to call
 * .stack manually.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

// Keys we treat as secrets at any depth. Match is case-insensitive
// on the full key name.
const REDACT_EXACT = new Set([
  "password",
  "secret",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "auth",
  "session",
  "access_token",
  "refresh_token",
  "client_secret",
  "service_role_key",
  "supabase_service_role_key",
  "stripe_webhook_secret",
  "cron_secret",
  "dashboard_test_secret",
]);

function maskEmail(s: string): string {
  // a@b.com -> a***@b.com. Keep just the leading char so debugging
  // ambiguous-user cases still works without leaking the full local
  // part.
  const at = s.indexOf("@");
  if (at < 1) return s;
  return `${s.slice(0, 1)}***${s.slice(at)}`;
}

function expandError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) return expandError(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (REDACT_EXACT.has(lower)) {
      out[k] = "[redacted]";
    } else if (k === "err" || k === "error") {
      out[k] = scrub(expandError(v), depth + 1);
    } else if (lower.endsWith("email") && typeof v === "string") {
      out[k] = maskEmail(v);
    } else if (lower === "emails" && Array.isArray(v)) {
      out[k] = v.map((e) => (typeof e === "string" ? maskEmail(e) : e));
    } else {
      out[k] = scrub(v, depth + 1);
    }
  }
  return out;
}

function emit(
  level: LogLevel,
  scope: string,
  message: string,
  context?: LogContext
) {
  const scrubbed = context ? (scrub(context) as LogContext) : undefined;

  // Production: structured JSON, one line per entry. Vercel Logs
  // parses it; Sentry's console integration captures the same shape
  // as a breadcrumb.
  if (process.env.NODE_ENV === "production") {
    const entry = {
      ts: new Date().toISOString(),
      level,
      scope,
      msg: message,
      ...(scrubbed ?? {}),
    };
    const line = JSON.stringify(entry);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  // Development: human-readable. Bracketed prefix mirrors the
  // pre-logger pattern so existing log statements look familiar.
  const prefix = `[${level}] [${scope}] ${message}`;
  const suffix = scrubbed && Object.keys(scrubbed).length > 0
    ? ` ${JSON.stringify(scrubbed)}`
    : "";
  if (level === "error") console.error(prefix + suffix);
  else if (level === "warn") console.warn(prefix + suffix);
  else console.log(prefix + suffix);
}

export const logger = {
  debug: (scope: string, message: string, context?: LogContext) =>
    emit("debug", scope, message, context),
  info: (scope: string, message: string, context?: LogContext) =>
    emit("info", scope, message, context),
  warn: (scope: string, message: string, context?: LogContext) =>
    emit("warn", scope, message, context),
  error: (scope: string, message: string, context?: LogContext) =>
    emit("error", scope, message, context),
};

// Exposed for the logger's own unit test. Don't import in app code —
// use `logger.info` etc. so production gets the scrubbing pass too.
export const __test_only__ = { scrub };
