/**
 * PerfTimer — Step-level performance measurement for job processing.
 *
 * Usage:
 *   const timer = new PerfTimer("job-handler", correlationId);
 *   timer.start("status-guard");
 *   await someWork();
 *   timer.end("status-guard");
 *   ...
 *   const report = timer.report();
 */

export interface TimingBreakdown {
  webhookToEnqueue?: number;
  queueWait?: number;
  statusGuard?: number;
  routing?: number;
  identitySync?: number;
  contextBuild?: number;
  llmCall?: number;
  toolExecution?: number;
  responseSave?: number;
  whatsappSend?: number;
  totalEndToEnd?: number;
  [key: string]: number | undefined;
}

export interface PerfReport {
  /** Total elapsed time from timer creation to report() call */
  totalMs: number;
  /** Per-step durations in ms */
  steps: Record<string, number>;
  /** Correlation ID for cross-referencing logs */
  correlationId: string;
  /** Structured breakdown matching AgentDebugInfo.timingBreakdown */
  breakdown: TimingBreakdown;
}

export class PerfTimer {
  private label: string;
  private correlationId: string;
  private createdAt: number;
  private activeSteps = new Map<string, number>();
  private completedSteps = new Map<string, number>();

  constructor(label: string, correlationId?: string) {
    this.label = label;
    this.correlationId = correlationId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.createdAt = Date.now();
  }

  /** Start timing a step */
  start(step: string): void {
    this.activeSteps.set(step, Date.now());
  }

  /** End timing a step and log it */
  end(step: string): number {
    const startTime = this.activeSteps.get(step);
    if (startTime === undefined) {
      console.warn(`[${this.correlationId}] ⚠️ PerfTimer: end('${step}') called without start`);
      return 0;
    }
    const duration = Date.now() - startTime;
    this.activeSteps.delete(step);
    this.completedSteps.set(step, duration);
    console.log(`[${this.correlationId}] ⏱️ ${this.label}.${step}=${duration}ms`);
    return duration;
  }

  /** Record an externally measured duration */
  record(step: string, durationMs: number): void {
    this.completedSteps.set(step, durationMs);
    console.log(`[${this.correlationId}] ⏱️ ${this.label}.${step}=${durationMs}ms`);
  }

  /** Get duration of a completed step */
  get(step: string): number | undefined {
    return this.completedSteps.get(step);
  }

  /** Generate full report */
  report(): PerfReport {
    const totalMs = Date.now() - this.createdAt;
    const steps: Record<string, number> = {};
    for (const [key, value] of this.completedSteps) {
      steps[key] = value;
    }

    // Build structured breakdown from step names
    const breakdown: TimingBreakdown = {};
    for (const [key, value] of this.completedSteps) {
      // Map step names to breakdown fields  
      if (key in breakdown || isBreakdownKey(key)) {
        breakdown[key] = value;
      }
    }
    breakdown.totalEndToEnd = totalMs;

    console.log(
      `[${this.correlationId}] ⏱️ ${this.label}.TOTAL=${totalMs}ms | ` +
      Object.entries(steps).map(([k, v]) => `${k}=${v}ms`).join(' ')
    );

    return { totalMs, steps, correlationId: this.correlationId, breakdown };
  }

  getCorrelationId(): string {
    return this.correlationId;
  }

  getCreatedAt(): number {
    return this.createdAt;
  }
}

function isBreakdownKey(key: string): key is string & keyof TimingBreakdown {
  const keys: Array<keyof TimingBreakdown> = [
    'webhookToEnqueue', 'queueWait', 'statusGuard', 'routing',
    'identitySync', 'contextBuild', 'llmCall', 'toolExecution',
    'responseSave', 'whatsappSend', 'totalEndToEnd',
  ];
  return keys.includes(key as keyof TimingBreakdown);
}

/**
 * Build a correlation ID from job metadata.
 * Format: convId:wamid:timestamp (truncated for readability)
 */
export function buildCorrelationId(
  conversationId: string,
  wamid?: string,
): string {
  const convShort = conversationId.slice(-8);
  const wamidShort = wamid ? wamid.slice(-8) : 'no-wamid';
  const ts = Date.now().toString(36);
  return `${convShort}:${wamidShort}:${ts}`;
}
