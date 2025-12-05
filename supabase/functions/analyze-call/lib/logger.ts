// Structured logging with correlation IDs and timing

export interface LogContext {
  correlationId: string;
  callId?: string;
  repId?: string;
  phase?: string;
}

export interface TimingMetrics {
  totalMs: number;
  phases: Record<string, number>;
}

/**
 * Generate a correlation ID for request tracing
 */
export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Structured logger with correlation ID support
 */
export class Logger {
  private context: LogContext;
  private startTime: number;
  private phaseTimings: Map<string, number> = new Map();
  private currentPhase: string | null = null;
  private currentPhaseStart: number = 0;

  constructor(correlationId?: string) {
    this.context = {
      correlationId: correlationId || generateCorrelationId()
    };
    this.startTime = Date.now();
  }

  setCallId(callId: string): void {
    this.context.callId = callId;
  }

  setRepId(repId: string): void {
    this.context.repId = repId;
  }

  /**
   * Start timing a phase
   */
  startPhase(phase: string): void {
    // End previous phase if any
    if (this.currentPhase) {
      this.endPhase();
    }
    this.currentPhase = phase;
    this.currentPhaseStart = Date.now();
    this.context.phase = phase;
    this.info(`Starting phase: ${phase}`);
  }

  /**
   * End current phase and record timing
   */
  endPhase(): number {
    if (!this.currentPhase) return 0;
    const duration = Date.now() - this.currentPhaseStart;
    this.phaseTimings.set(this.currentPhase, duration);
    this.info(`Completed phase: ${this.currentPhase} (${duration}ms)`);
    this.currentPhase = null;
    this.context.phase = undefined;
    return duration;
  }

  /**
   * Get all timing metrics
   */
  getTimings(): TimingMetrics {
    const phases: Record<string, number> = {};
    this.phaseTimings.forEach((value, key) => {
      phases[key] = value;
    });
    return {
      totalMs: Date.now() - this.startTime,
      phases
    };
  }

  private formatMessage(level: string, message: string, data?: Record<string, unknown>): string {
    const logObj = {
      level,
      correlationId: this.context.correlationId,
      callId: this.context.callId,
      repId: this.context.repId,
      phase: this.context.phase,
      message,
      ...data
    };
    return `[analyze-call] ${JSON.stringify(logObj)}`;
  }

  info(message: string, data?: Record<string, unknown>): void {
    console.log(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, data?: Record<string, unknown>): void {
    console.error(this.formatMessage('error', message, data));
  }

  /**
   * Log final summary with all timings
   */
  logSummary(success: boolean, analysisId?: string): void {
    const timings = this.getTimings();
    this.info('Analysis complete', {
      success,
      analysisId,
      totalDurationMs: timings.totalMs,
      phaseTimings: timings.phases
    });
  }
}
