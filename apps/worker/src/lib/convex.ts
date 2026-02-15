import { ConvexHttpClient } from "convex/browser";

/**
 * Creates a Convex HTTP client for server-side usage.
 * Used by the worker to read/write conversation data.
 */
export function createConvexClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL;
  if (!url) {
    throw new Error("CONVEX_URL environment variable is required");
  }
  return new ConvexHttpClient(url);
}

export type { ConvexHttpClient };
