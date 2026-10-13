import "server-only";

type Level = "info" | "warn" | "error";

export type LogContext = {
  operation: string;
  userId?: string | null;
  provider?: string;
  resourceId?: string | null;
  [key: string]: unknown;
};

const SECRET_KEYS = /(key|secret|token|password|authorization|cookie)/i;
const SECRET_VALUES = /(lmp_(live|test)_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{8,}|re_[A-Za-z0-9_]{8,}|sb_secret_[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._-]+)/g;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (typeof value === "string") return value.replace(SECRET_VALUES, "[redacted]");
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "[redacted]" : scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: scrub(error.message), ...("code" in error ? { code: (error as { code?: unknown }).code } : {}) };
  }
  return { message: scrub(String(error)) };
}

function write(level: Level, message: string, context: LogContext, error?: unknown) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(scrub(context) as Record<string, unknown>),
    ...(error !== undefined ? { error: describeError(error) } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const log = {
  info: (message: string, context: LogContext) => write("info", message, context),
  warn: (message: string, context: LogContext, error?: unknown) => write("warn", message, context, error),
  error: (message: string, context: LogContext, error?: unknown) => write("error", message, context, error),
};

export const __test__ = { scrub };
