import { createAI, upmetricsSink, noopSink } from "@broberg/ai-sdk";
import { env } from "../env";

// Ét ai-sdk-facade-instans for hele appen (reuse-first: aldrig rå provider-
// SDK'er). Cost-tracking: upmetricsSink når nøglen findes, ellers ship-dark.
export const ai = createAI({
  costSink: env.UPMETRICS_API_KEY
    ? upmetricsSink({
        baseUrl: "https://upmetrics.org",
        apiKey: env.UPMETRICS_API_KEY,
        agentName: "contentpush",
      })
    : noopSink,
});
