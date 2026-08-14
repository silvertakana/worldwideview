"use client";

import * as Sentry from "@sentry/nextjs";
import { reportToDiagnosticEngine } from "@worldwideview/wwv-diagnostics-client";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
    reportToDiagnosticEngine(
      {
        message: error?.message || "Unknown error",
        severity: "error",
        category: "runtime",
        stack: error?.stack,
        metadata: { digest: error?.digest },
      },
      "worldwideview",
    );
  }, [error]);

  return (
    <html lang="en">
      <body>
        <NextError statusCode={500} title="Error" />
      </body>
    </html>
  );
}
