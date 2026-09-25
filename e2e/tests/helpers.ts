import { createHmac } from "node:crypto"
import type { BrowserContext } from "@playwright/test"

/** Seeded people (scripts/seed.sql). */
export const USERS = {
  maya: "00000000-0000-0000-0000-000000000001",
  priya: "00000000-0000-0000-0000-000000000002",
  sam: "00000000-0000-0000-0000-000000000003",
  jonah: "00000000-0000-0000-0000-000000000004",
  leaving: "00000000-0000-0000-0000-000000000008",
  newbie: "00000000-0000-0000-0000-000000000009",
} as const

export const PRIYA_FLAT_WHITE = "20000000-0000-0000-0000-000000000011"

const SECRET = process.env.E2E_JWT_SECRET ?? "test-secret-test-secret-test-secret-123"
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")

/** Signs a browser context in as a seeded user by writing the Supabase session cookie. */
export async function signInAs(context: BrowserContext, who: keyof typeof USERS) {
  const sub = USERS[who]
  const exp = Math.floor(Date.now() / 1000) + 3600 * 24
  const header = b64({ alg: "HS256", typ: "JWT" })
  const payload = b64({ sub, role: "authenticated", aud: "authenticated", exp, email: `${who}@example.com` })
  const token = `${header}.${payload}.${createHmac("sha256", SECRET).update(`${header}.${payload}`).digest("base64url")}`
  const session = {
    access_token: token, token_type: "bearer", expires_in: 3600 * 24, expires_at: exp, refresh_token: "e2e",
    user: { id: sub, aud: "authenticated", role: "authenticated", email: `${who}@example.com` },
  }
  await context.addCookies([{
    name: "sb-localhost-auth-token",
    value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
    domain: "localhost",
    path: "/",
  }])
}
