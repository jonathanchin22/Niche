// A tiny Supabase stand-in for end-to-end tests:
//   /auth/v1/user     → the user named in the bearer JWT (tests mint the JWT)
//   /auth/v1/logout   → 204
//   /storage/v1/...   → empty listings / no-op deletes (tests don't upload)
//   /rest/v1/...      → proxied to PostgREST, which verifies the JWT itself
import http from "node:http"

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399)
const POSTGREST = new URL(process.env.POSTGREST_URL ?? "http://localhost:3999")

function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*")
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ?? "*")
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" })
  res.end(JSON.stringify(body))
}

http.createServer((req, res) => {
  cors(req, res)
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end() }
  const auth = req.headers.authorization ?? ""

  if (req.url.startsWith("/auth/v1/user")) {
    try {
      const claims = JSON.parse(Buffer.from(auth.split(" ")[1].split(".")[1], "base64url"))
      return json(res, 200, {
        id: claims.sub, aud: "authenticated", role: "authenticated", email: claims.email ?? `${claims.sub}@example.com`,
        app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
      })
    } catch {
      return json(res, 401, { message: "invalid token" })
    }
  }
  if (req.url.startsWith("/auth/v1/logout")) { res.writeHead(204); return res.end() }
  if (req.url.startsWith("/storage/v1/")) return json(res, 200, [])

  if (req.url.startsWith("/rest/v1")) {
    const proxy = http.request({
      host: POSTGREST.hostname, port: POSTGREST.port, method: req.method,
      path: req.url.slice("/rest/v1".length) || "/",
      headers: { ...req.headers, host: POSTGREST.host },
    }, upstream => {
      const headers = { ...upstream.headers }
      delete headers["access-control-allow-origin"]
      res.writeHead(upstream.statusCode ?? 502, headers)
      upstream.pipe(res)
    })
    proxy.on("error", e => json(res, 502, { message: String(e) }))
    return req.pipe(proxy)
  }

  json(res, 404, {})
}).listen(PORT, () => console.log(`fake supabase on ${PORT} → PostgREST ${POSTGREST.href}`))
