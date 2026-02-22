/**
 * Request tracing with correlation IDs.
 *
 * Provides consistent logging with function name and correlation ID prefix
 * across the analysis pipeline and chat functions.
 */

/**
 * Extract or generate a correlation ID from the request.
 * Checks X-Correlation-ID header first, falls back to a short random ID.
 */
export function getCorrelationId(req: Request): string {
  return req.headers.get('X-Correlation-ID') || crypto.randomUUID().slice(0, 12);
}

/**
 * Create a traced logger that prefixes all messages with function name and correlation ID.
 */
export function createTracedLogger(functionName: string, correlationId: string) {
  const prefix = `[${functionName}][${correlationId}]`;
  return {
    info: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  };
}
