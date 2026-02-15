import "dotenv/config";
import express from "express";
import { createConvexClient } from "./lib/convex.js";
import { getSupabaseAdmin } from "./lib/supabase.js";
import { InMemoryQueue } from "./queue/in-memory-queue.js";
import { createJobHandler } from "./agent/job-handler.js";
import { createWebhookRouter } from "./routes/webhook.js";
import { createHealthRouter } from "./routes/health.js";
import { createOtpRouter } from "./routes/otp.js";
import { recoverPendingJobs } from "./queue/recovery.js";
import { DEFAULT_QUEUE_CONFIG } from "./config.js";
import {
  startOtpCleanupJob,
  stopOtpCleanupJob,
} from "./services/otp/index.js";

const PORT = parseInt(process.env.PORT || "3001", 10);

async function main() {
  console.log("🚀 Musait Chat Worker starting...");

  // --- Initialize Convex client ---
  const convex = createConvexClient();
  console.log("✅ Convex client initialized");

  // --- Initialize Supabase admin client ---
  const supabase = getSupabaseAdmin();

  // --- Initialize Queue ---
  const queue = new InMemoryQueue(DEFAULT_QUEUE_CONFIG);
  const jobHandler = createJobHandler(convex);
  queue.startWorker(jobHandler);
  console.log(
    `✅ Queue started (concurrency: ${DEFAULT_QUEUE_CONFIG.concurrency})`
  );

  // --- Recover pending jobs from Convex ---
  await recoverPendingJobs(convex, queue);

  // --- Start OTP cleanup job (daily) ---
  startOtpCleanupJob(supabase);

  // --- Express Server ---
  const app = express();
  app.use(express.json());

  // Routes
  app.use("/webhook", createWebhookRouter(convex, queue, supabase));
  app.use("/otp", createOtpRouter(supabase));
  app.use("/health", createHealthRouter(queue));

  app.listen(PORT, () => {
    console.log(`✅ Worker listening on port ${PORT}`);
    console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook/whatsapp`);
    console.log(`🔐 OTP endpoint: http://localhost:${PORT}/otp/request`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
  });

  // --- Graceful shutdown ---
  const shutdown = async (signal: string) => {
    console.log(`\n⏳ ${signal} received. Shutting down gracefully...`);
    stopOtpCleanupJob();
    await queue.stop();
    console.log("👋 Worker stopped.");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("❌ Worker failed to start:", err);
  process.exit(1);
});
