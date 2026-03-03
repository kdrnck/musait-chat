/**
 * LatencyTracker — Sliding-window latency statistics singleton.
 *
 * Collects timing breakdown from each completed job and exposes
 * p50/p90/p99 percentiles for health endpoint and monitoring.
 */

import type { TimingBreakdown } from "./perf-timer.js";

interface LatencySample {
  timestamp: number;
  totalMs: number;
  breakdown: TimingBreakdown;
  correlationId: string;
  tenantId?: string | null;
}

interface PercentileStats {
  p50: number;
  p90: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
  sampleCount: number;
}

export interface LatencyStats {
  endToEnd: PercentileStats;
  byStep: Record<string, { p50: number; p90: number }>;
  sampleCount: number;
  oldestSampleAgeMs: number;
}

const WINDOW_SIZE = 200; // Keep last 200 samples

class LatencyTrackerSingleton {
  private samples: LatencySample[] = [];

  /** Record a completed job's timing */
  record(opts: {
    totalMs: number;
    breakdown: TimingBreakdown;
    correlationId: string;
    tenantId?: string | null;
  }): void {
    this.samples.push({
      timestamp: Date.now(),
      totalMs: opts.totalMs,
      breakdown: opts.breakdown,
      correlationId: opts.correlationId,
      tenantId: opts.tenantId,
    });

    // Evict old samples
    if (this.samples.length > WINDOW_SIZE) {
      this.samples = this.samples.slice(-WINDOW_SIZE);
    }
  }

  /** Get aggregate stats */
  getStats(): LatencyStats {
    if (this.samples.length === 0) {
      return {
        endToEnd: { p50: 0, p90: 0, p99: 0, min: 0, max: 0, avg: 0, sampleCount: 0 },
        byStep: {},
        sampleCount: 0,
        oldestSampleAgeMs: 0,
      };
    }

    const totals = this.samples.map((s) => s.totalMs);
    const endToEnd = computePercentiles(totals);

    // Compute per-step stats
    const stepValues = new Map<string, number[]>();
    for (const sample of this.samples) {
      for (const [key, value] of Object.entries(sample.breakdown)) {
        if (typeof value === "number" && key !== "totalEndToEnd") {
          if (!stepValues.has(key)) stepValues.set(key, []);
          stepValues.get(key)!.push(value);
        }
      }
    }

    const byStep: Record<string, { p50: number; p90: number }> = {};
    for (const [key, values] of stepValues) {
      const sorted = values.slice().sort((a, b) => a - b);
      byStep[key] = {
        p50: percentile(sorted, 50),
        p90: percentile(sorted, 90),
      };
    }

    const oldestSampleAgeMs = Date.now() - this.samples[0].timestamp;

    return {
      endToEnd,
      byStep,
      sampleCount: this.samples.length,
      oldestSampleAgeMs,
    };
  }

  /** Get recent samples for debugging */
  getRecentSamples(limit = 10): LatencySample[] {
    return this.samples.slice(-limit);
  }
}

function computePercentiles(values: number[]): PercentileStats {
  if (values.length === 0) {
    return { p50: 0, p90: 0, p99: 0, min: 0, max: 0, avg: 0, sampleCount: 0 };
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p99: percentile(sorted, 99),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
    sampleCount: sorted.length,
  };
}

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

// Singleton export
export const latencyTracker = new LatencyTrackerSingleton();
