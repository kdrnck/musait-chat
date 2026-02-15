import { Router, type Request, type Response } from "express";
import type { InMemoryQueue } from "../queue/in-memory-queue.js";

/**
 * Health check endpoint for Railway.
 * Returns queue status and uptime info.
 */
export function createHealthRouter(
  queue: InMemoryQueue
): Router {
  const router = Router();
  const startTime = Date.now();

  router.get("/", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      uptime: Math.floor((Date.now() - startTime) / 1000),
      queue: {
        size: queue.size(),
        processing: queue.processingCount,
      },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}
