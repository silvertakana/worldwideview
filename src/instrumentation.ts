import * as Sentry from "@sentry/nextjs";
import { reportToDiagnosticEngine } from "@worldwideview/wwv-diagnostics-client";
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (!process.env.ENCRYPTION_MASTER_KEY && !process.env.MARKETPLACE_API_KEY) {
      throw new Error("[startup] ENCRYPTION_MASTER_KEY is not set. The server cannot start without it.");
    }
    if (!process.env.BETTER_AUTH_SECRET) {
      throw new Error("[startup] BETTER_AUTH_SECRET is not set. Better Auth requires it to sign session cookies. Generate one with `openssl rand -base64 32` and add `BETTER_AUTH_SECRET=<your-secret>` to your .env file. See .env.example for all required variables.");
    }
    if (process.env.NEXT_PUBLIC_WWV_EDITION === "demo" && !process.env.MARKETPLACE_API_KEY) {
      throw new Error("[startup] DEMO EDITION requires MARKETPLACE_API_KEY. Set it in env vars and restart.");
    }
    if (process.env.NEXT_PUBLIC_WWV_EDITION === "cloud" && process.env.MARKETPLACE_API_KEY) {
      console.warn(
        "[startup] WARNING: MARKETPLACE_API_KEY is set on edition=cloud. " +
        "All users will share the same credential. Unset this env var if unintended."
      );
    }
    if (process.env.MARKETPLACE_API_KEY && process.env.NEXT_PUBLIC_WWV_EDITION !== "demo" && process.env.NEXT_PUBLIC_WWV_EDITION !== "cloud") {
      console.log("[startup] Using MARKETPLACE_API_KEY credential source (env var path).");
    }
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Capture errors from Server Components, middleware, and proxies
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  Sentry.captureRequestError(error, request, context);
  const err = error instanceof Error ? error : new Error(String(error));
  reportToDiagnosticEngine(
    {
      message: err.message,
      severity: "error",
      category: "runtime",
      stack: err.stack,
      metadata: { path: request.path, method: request.method, routePath: context.routePath },
    },
    "worldwideview",
  );
};
