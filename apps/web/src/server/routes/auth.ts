import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "../env";

// F011.2: nøgle-gate (husregel: HTTP-services altid auth). Én bruger
// (Christian) — adgangsnøgle i secret, session-cookie afledt deterministisk
// af nøglen (HMAC), custom login-form i SPA'en (aldrig native dialogs).
// DASHBOARD_ACCESS_KEY usat = gate inaktiv (lokal dev).

const COOKIE_NAME = "cp_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export function sessionToken(): string | null {
  if (!env.DASHBOARD_ACCESS_KEY) return null;
  return createHmac("sha256", env.DASHBOARD_ACCESS_KEY)
    .update("contentpush-session-v1")
    .digest("hex");
}

export function isAuthed(cookieValue: string | undefined): boolean {
  const expected = sessionToken();
  if (!expected) return true; // gate inaktiv
  if (!cookieValue || cookieValue.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(cookieValue), Buffer.from(expected));
}

const loginSchema = z.object({ key: z.string().min(1) });

export const authRoute = new Hono()
  .get("/status", (c) => {
    const required = Boolean(env.DASHBOARD_ACCESS_KEY);
    return c.json({
      required,
      authed: !required || isAuthed(getCookie(c, COOKIE_NAME)),
    });
  })
  .post("/login", async (c) => {
    if (!env.DASHBOARD_ACCESS_KEY) return c.json({ ok: true, gate: "inaktiv" });
    const body = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: "Nøgle mangler" }, 400);
    const key = Buffer.from(body.data.key);
    const expected = Buffer.from(env.DASHBOARD_ACCESS_KEY);
    if (key.length !== expected.length || !timingSafeEqual(key, expected)) {
      return c.json({ error: "Forkert adgangsnøgle" }, 401);
    }
    setCookie(c, COOKIE_NAME, sessionToken()!, {
      httpOnly: true,
      secure: Boolean(env.APP_PUBLIC_URL),
      sameSite: "Lax",
      path: "/",
      maxAge: THIRTY_DAYS,
    });
    return c.json({ ok: true });
  });
