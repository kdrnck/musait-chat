import type { AgentJob, AgentQueue, QueueConfig } from "@musait/shared";

/**
 * InMemoryQueue - MVP queue implementation.
 *
 * MIGRATION NOTE: This will be replaced by RedisQueue (BullMQ + Upstash)
 * when scaling beyond MVP. The AgentQueue interface MUST remain unchanged.
 * Only this file gets replaced — the job handler stays identical.
 */
export class InMemoryQueue implements AgentQueue {
  private jobs: AgentJob[] = [];
  private processing = new Set<string>();
  private handler: ((job: AgentJob) => Promise<void>) | null = null;
  private isRunning = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private config: QueueConfig;
  /**
   * Per-conversation lock: only one job per conversation runs at a time.
   * Other conversations can still execute in parallel up to `concurrency`.
   */
  private conversationLocks = new Set<string>();

  constructor(config: QueueConfig) {
    this.config = config;
  }

  async enqueue(job: AgentJob): Promise<void> {
    // Dedup: don't enqueue if already in queue or processing
    if (
      this.jobs.some((j) => j.id === job.id) ||
      this.processing.has(job.id)
    ) {
      console.log(`⏭️ Job ${job.id} already queued/processing, skipping`);
      return;
    }

    this.jobs.push(job);
    console.log(`📥 Job enqueued: ${job.id} (queue size: ${this.jobs.length})`);

    // Immediately try to process if we have capacity
    this.processNext();
  }

  startWorker(handler: (job: AgentJob) => Promise<void>): void {
    this.handler = handler;
    this.isRunning = true;

    // Poll every 500ms in case processNext misses something
    this.pollInterval = setInterval(() => {
      if (this.isRunning) this.processNext();
    }, 500);
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    // Wait for in-flight jobs to complete (max 30s)
    const deadline = Date.now() + 30_000;
    while (this.processing.size > 0 && Date.now() < deadline) {
      console.log(
        `⏳ Waiting for ${this.processing.size} in-flight job(s)...`
      );
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (this.processing.size > 0) {
      console.warn(
        `⚠️ Force stopping with ${this.processing.size} jobs still processing`
      );
    }
  }

  size(): number {
    return this.jobs.length;
  }

  get processingCount(): number {
    return this.processing.size;
  }

  // --- Internal ---

  private processNext(): void {
    if (!this.isRunning || !this.handler) return;
    if (this.processing.size >= this.config.concurrency) return;
    if (this.jobs.length === 0) return;

    // Find the first job whose conversation is NOT locked
    const idx = this.jobs.findIndex(
      (j) => !this.conversationLocks.has(j.conversationId)
    );
    if (idx === -1) return; // all pending jobs belong to locked conversations

    const job = this.jobs.splice(idx, 1)[0];
    if (!job) return;

    this.processing.add(job.id);
    this.conversationLocks.add(job.conversationId);
    console.log(`⚙️ Processing job: ${job.id} (conv lock: ${job.conversationId})`);

    // Wrap in timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Job ${job.id} timed out`)),
        this.config.jobTimeout
      );
    });

    Promise.race([this.handler(job), timeoutPromise])
      .then(() => {
        console.log(`✅ Job completed: ${job.id}`);
      })
      .catch((err) => {
        console.error(`❌ Job failed: ${job.id}`, err);
        this.handleRetry(job);
      })
      .finally(() => {
        this.processing.delete(job.id);
        this.conversationLocks.delete(job.conversationId);
        // Try to process next job
        this.processNext();
      });
  }

  private handleRetry(job: AgentJob): void {
    if (job.retryCount >= this.config.maxRetries) {
      console.error(
        `💀 Job ${job.id} exceeded max retries (${this.config.maxRetries}), marking as failed`
      );
      return; // Job handler should mark as failed in Convex
    }

    const delay =
      this.config.retryBaseDelay * Math.pow(2, job.retryCount);
    console.log(
      `🔄 Retrying job ${job.id} in ${delay}ms (attempt ${job.retryCount + 1}/${this.config.maxRetries})`
    );

    setTimeout(() => {
      this.enqueue({
        ...job,
        retryCount: job.retryCount + 1,
      });
    }, delay);
  }
}
