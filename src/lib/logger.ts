/**
 * Production-safe logging utility
 * 
 * Features:
 * - Environment-aware (respects production mode)
 * - Sensitive data redaction (emails, tokens, passwords)
 * - Configurable log levels
 * - Structured logging with timestamps
 * - Namespace support for component-specific logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  enableInProduction: boolean;
}

// Log level hierarchy (lower = more verbose)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Keys that should have their values redacted
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'auth',
  'bearer',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'session',
  'credential',
  'private',
]);

// Patterns to detect sensitive data in values
const SENSITIVE_PATTERNS = [
  /^[A-Za-z0-9-_]{20,}$/, // Long tokens
  /^Bearer\s+/i, // Bearer tokens
  /^sk-[a-zA-Z0-9]+/, // OpenAI-style keys
  /^eyJ[a-zA-Z0-9_-]+\.eyJ/, // JWT tokens
];

const isProduction = import.meta.env.PROD;
const configuredLevel = (import.meta.env.VITE_LOG_LEVEL as LogLevel) || (isProduction ? 'warn' : 'debug');

const defaultConfig: LoggerConfig = {
  level: configuredLevel,
  enableInProduction: false,
};

/**
 * Check if a key name suggests sensitive data
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.has(lowerKey) || 
    Array.from(SENSITIVE_KEYS).some(sensitive => lowerKey.includes(sensitive));
}

/**
 * Check if a value looks like sensitive data
 */
function isSensitiveValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(value));
}

/**
 * Mask a string value for logging
 */
function maskValue(value: string): string {
  if (value.length <= 8) return '***';
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

/**
 * Mask email addresses
 */
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 1) return '***@***';
  return `${email[0]}***@***`;
}

/**
 * Deep sanitize an object, redacting sensitive data
 */
function sanitizeData(data: unknown, depth = 0): unknown {
  // Prevent infinite recursion
  if (depth > 10) return '[Max depth reached]';

  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Check for email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data)) {
      return maskEmail(data);
    }
    // Check for sensitive value patterns
    if (isSensitiveValue(data)) {
      return maskValue(data);
    }
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, depth + 1));
  }

  if (typeof data === 'object') {
    // Handle Error objects specially
    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: isProduction ? undefined : data.stack,
      };
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        sanitized[key] = typeof value === 'string' ? maskValue(value) : '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value, depth + 1);
      }
    }
    return sanitized;
  }

  return String(data);
}

/**
 * Format timestamp for logs
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Console styling for different log levels (development only)
 */
const LOG_STYLES: Record<LogLevel, string> = {
  debug: 'color: #6b7280', // gray
  info: 'color: #3b82f6',  // blue
  warn: 'color: #f59e0b',  // amber
  error: 'color: #ef4444', // red
};

/**
 * Check if logging should be performed for this level
 */
function shouldLog(level: LogLevel, config: LoggerConfig): boolean {
  // In production, only log if explicitly enabled or it's warn/error
  if (isProduction && !config.enableInProduction) {
    return LOG_LEVELS[level] >= LOG_LEVELS.warn;
  }
  return LOG_LEVELS[level] >= LOG_LEVELS[config.level];
}

/**
 * Core logging function
 */
function log(
  level: LogLevel,
  namespace: string,
  message: string,
  data?: unknown,
  config: LoggerConfig = defaultConfig
): void {
  if (!shouldLog(level, config)) return;

  const timestamp = getTimestamp();
  const prefix = namespace ? `[${namespace}]` : '';
  const sanitizedData = data !== undefined ? sanitizeData(data) : undefined;

  // In development, use styled console output
  if (!isProduction) {
    const style = LOG_STYLES[level];
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    
    if (sanitizedData !== undefined) {
      consoleMethod(`%c${timestamp} ${prefix} ${message}`, style, sanitizedData);
    } else {
      consoleMethod(`%c${timestamp} ${prefix} ${message}`, style);
    }
  } else {
    // In production, use plain logging (for log aggregation services)
    const logEntry = {
      timestamp,
      level,
      namespace: namespace || undefined,
      message,
      data: sanitizedData,
    };
    
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(JSON.stringify(logEntry));
  }
}

/**
 * Logger interface for a specific namespace
 */
export interface Logger {
  debug: (message: string, data?: unknown) => void;
  info: (message: string, data?: unknown) => void;
  warn: (message: string, data?: unknown) => void;
  error: (message: string, data?: unknown) => void;
}

/**
 * Create a namespaced logger instance
 */
export function createLogger(namespace: string, config: Partial<LoggerConfig> = {}): Logger {
  const mergedConfig = { ...defaultConfig, ...config };
  
  return {
    debug: (message: string, data?: unknown) => log('debug', namespace, message, data, mergedConfig),
    info: (message: string, data?: unknown) => log('info', namespace, message, data, mergedConfig),
    warn: (message: string, data?: unknown) => log('warn', namespace, message, data, mergedConfig),
    error: (message: string, data?: unknown) => log('error', namespace, message, data, mergedConfig),
  };
}

/**
 * Default logger instance (no namespace)
 */
export const logger: Logger = {
  debug: (message: string, data?: unknown) => log('debug', '', message, data),
  info: (message: string, data?: unknown) => log('info', '', message, data),
  warn: (message: string, data?: unknown) => log('warn', '', message, data),
  error: (message: string, data?: unknown) => log('error', '', message, data),
};

// Export utility functions for testing
export const _internals = {
  sanitizeData,
  isSensitiveKey,
  isSensitiveValue,
  maskValue,
  maskEmail,
};
