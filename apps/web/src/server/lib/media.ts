import { createMedia } from "@broberg/media";
import { env } from "../env";

// Ship-dark: uden R2-creds er media null og upload-ruter svarer 503.
// Bucket provisioneres af buddy via dns-mcp (EU-jurisdiction, immutable).
export const media =
  env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
    ? createMedia({
        provider: "r2",
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucket: env.R2_BUCKET ?? "contentpush-media",
        jurisdiction: "eu",
      })
    : null;

/** Variant-navnene ingest-pipelinen (F003.2) altid producerer. */
export const VARIANTS = ["original", "thumb", "grid", "full"] as const;

export function variantKey(baseKey: string, variant: string, contentType: string) {
  const ext = contentType === "image/webp" ? "webp" : "jpg";
  return `${baseKey}/${variant}.${ext}`;
}
