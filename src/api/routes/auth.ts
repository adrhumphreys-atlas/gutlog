import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, isNull } from "drizzle-orm";
import { authTokens, users } from "../db/schema";
import { signJwt } from "../middleware/auth";
import { sendMagicLinkSchema } from "../../shared/validation";
import type { Env } from "../index";

export const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/send
 *
 * Send a magic link email. Creates a single-use token (15-min TTL)
 * in D1 and emails it via Resend.
 */
authRoutes.post("/send", async (c) => {
  const body = await c.req.json();
  const result = sendMagicLinkSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Invalid email", details: result.error.flatten() },
      400,
    );
  }

  const { email } = result.data;
  const db = drizzle(c.env.DB);

  // Generate crypto-random token (128-bit)
  const tokenBytes = new Uint8Array(16);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min TTL
  const id = crypto.randomUUID();

  await db.insert(authTokens).values({
    id,
    email,
    token,
    expiresAt,
    createdAt: now,
  });

  // Send email via Resend
  const verifyUrl = `${c.env.APP_URL}/api/auth/verify?token=${token}`;

  console.log(`URL: ${verifyUrl}`);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "GutLog <noreply@gutlog.app>",
        to: email,
        subject: "Your GutLog login link",
        html: `
          <h2>Log in to GutLog</h2>
          <p>Click the link below to sign in. This link expires in 15 minutes.</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#4ade80;color:#000;border-radius:8px;text-decoration:none;font-weight:600;">
            Sign in to GutLog
          </a>
          <p style="color:#666;font-size:12px;margin-top:16px;">If you didn't request this, you can safely ignore this email.</p>
        `,
      }),
    });

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Resend API error:", res.status, errorBody);
      return c.json({ error: "Failed to send email. Please try again." }, 500);
    }
  } catch (err) {
    console.error("Email send error:", err);
    return c.json({ error: "Failed to send email. Please try again." }, 500);
  }

  return c.json({ message: "Magic link sent. Check your email." });
});

/**
 * GET /api/auth/verify?token=
 *
 * Verify a magic link token. On success:
 * - Marks token as used (single-use)
 * - Creates user if first login
 * - Sets signed JWT session cookie
 * - Redirects to /
 */
authRoutes.get("/verify", async (c) => {
  const token = c.req.query("token");

  if (!token) {
    return c.json({ error: "Missing token" }, 400);
  }

  const db = drizzle(c.env.DB);

  // Find token — must exist, not expired, not already used
  const [authToken] = await db
    .select()
    .from(authTokens)
    .where(and(eq(authTokens.token, token), isNull(authTokens.usedAt)))
    .limit(1);

  if (!authToken) {
    return c.json({ error: "Invalid or already used token" }, 401);
  }

  if (new Date(authToken.expiresAt) < new Date()) {
    return c.json({ error: "Token expired" }, 401);
  }

  // Mark as used (single-use enforcement)
  await db
    .update(authTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(authTokens.id, authToken.id));

  // Find or create user
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, authToken.email))
    .limit(1);

  if (!user) {
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.insert(users).values({
      id: userId,
      email: authToken.email,
      createdAt: now,
    });
    [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  }

  // Sign JWT (7-day session)
  const jwt = await signJwt(
    {
      userId: user.id,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    },
    c.env.JWT_SECRET,
  );

  // Set session cookie
  setCookie(c, "session", jwt, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  // Redirect to app
  return c.redirect("/");
});

/**
 * POST /api/auth/logout
 *
 * Clear the session cookie.
 */
authRoutes.post("/logout", async (c) => {
  setCookie(c, "session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 0,
  });

  return c.json({ message: "Logged out" });
});
