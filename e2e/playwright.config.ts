import { defineConfig, devices } from "@playwright/test"

// Brew against a local stand-in for Supabase (Postgres + PostgREST + fake auth,
// see scripts/). Start those first; CI does it in .github/workflows/ci.yml.
const PORT = Number(process.env.E2E_APP_PORT ?? 3100)

export default defineConfig({
  testDir: "tests",
  // Tests share one seeded database and some change it, so run them in order.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["iPhone 13"],
    browserName: "chromium",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  webServer: {
    command: `pnpm --filter @niche/brew exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/auth/login`,
    reuseExistingServer: !process.env.CI,
    // Server-side area seeding reads cafés from the fake server's fixture.
    env: { OVERPASS_URL: process.env.OVERPASS_URL ?? "http://localhost:54399/overpass" },
    timeout: 120_000,
  },
})
