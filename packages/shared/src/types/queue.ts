// Queue abstraction layer - Redis-ready from day one
// This interface MUST remain stable during Redis migration.
// Only the implementation changes, never the consumer.

export interface AgentJob {
  /** Unique job ID (typically the message ID from Convex) */
  id: string;
  /** Convex conversation ID */
  conversationId: string;
  /** Customer phone number (E.164 format) */
  customerPhone: string;
  /** WhatsApp phone_number_id that received the message */
  phoneNumberId: string;
  /** The incoming message content */
  messageContent: string;
  /** Tenant ID (null if unbound/master number) */
  tenantId: string | null;
  /** Timestamp when job was created */
  createdAt: number;
  /** Current retry count */
  retryCount: number;
}

export interface AgentQueue {
  /**
   * Add a job to the queue.
   * Must be non-blocking and return immediately.
   */
  enqueue(job: AgentJob): Promise<void>;

  /**
   * Start consuming jobs from the queue.
   * The handler processes one job at a time (or up to concurrency limit).
   * This method should be called once at worker startup.
   */
  startWorker(handler: (job: AgentJob) => Promise<void>): void;

  /**
   * Stop the worker gracefully.
   * Waits for in-flight jobs to complete.
   */
  stop(): Promise<void>;

  /**
   * Get current queue size (for monitoring).
   */
  size(): number;
}

// Queue configuration
export interface QueueConfig {
  /** Max concurrent job processing (default: 1 for MVP) */
  concurrency: number;
  /** Max retries before marking as failed (default: 3) */
  maxRetries: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  retryBaseDelay: number;
  /** Job processing timeout in ms (default: 30000) */
  jobTimeout: number;
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  concurrency: 1,
  maxRetries: 3,
  retryBaseDelay: 1000,
  jobTimeout: 30_000,
};
