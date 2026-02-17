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

  // TEMPORARY: Debug endpoint to diagnose env var issues
  // TODO: REMOVE after webhook verification is fixed
  router.get("/debug-env", (_req: Request, res: Response) => {
    const token = process.env.WHATSAPP_VERIFY_TOKEN || "";
    const hasSecret = !!process.env.META_APP_SECRET;
    const hasApiKey = !!process.env.INTERNAL_API_KEY;
    const hasSupabase = !!process.env.SUPABASE_URL;
    const nodeEnv = process.env.NODE_ENV || "not set";

    res.json({
      whatsapp_verify_token: {
        length: token.length,
        preview: token.length > 0 ? token.substring(0, 4) + "..." : "(empty)",
      },
      env_vars_present: {
        META_APP_SECRET: hasSecret,
        INTERNAL_API_KEY: hasApiKey,
        SUPABASE_URL: hasSupabase,
      },
      NODE_ENV: nodeEnv,
    });
  });

  return router;
}
