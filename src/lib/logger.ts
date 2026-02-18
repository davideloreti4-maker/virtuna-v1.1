type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_VALUES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: LogLevel =
  process.env.NODE_ENV === "production" ? "info" : "debug";

interface LogEntry {
  level: LogLevel;
  msg: string;
  timestamp: string;
  [key: string]: unknown;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_VALUES[level] >= LEVEL_VALUES[MIN_LEVEL];
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }
  // Pretty format for development
  const { level, msg, timestamp, ...rest } = entry;
  const extra =
    Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
  return `[${timestamp}] ${level.toUpperCase()} ${msg}${extra}`;
}

function emit(
  level: LogLevel,
  msg: string,
  bindings: Record<string, unknown>,
  data: Record<string, unknown>,
): void {
  if (!shouldLog(level)) return;
  const entry: LogEntry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...bindings,
    ...data,
  };
  const formatted = formatEntry(entry);
  if (level === "error") console.error(formatted);
  else if (level === "warn") console.warn(formatted);
  else console.log(formatted);
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(
  bindings: Record<string, unknown> = {},
): Logger {
  return {
    debug: (msg, data = {}) => emit("debug", msg, bindings, data),
    info: (msg, data = {}) => emit("info", msg, bindings, data),
    warn: (msg, data = {}) => emit("warn", msg, bindings, data),
    error: (msg, data = {}) => emit("error", msg, bindings, data),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger();
