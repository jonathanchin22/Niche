import { expect, test } from "@playwright/test"
import { PRIYA_FLAT_WHITE, signInAs } from "./helpers"

test.describe.configure({ mode: "serial" })

test("privacy and terms are public", async ({ page }) => {
  await page.goto("/privacy")
  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole("heading", { name: "privacy" })).toBeVisible()
  await page.goto("/terms")
  await expect(page.getByRole("heading", { name: "terms" })).toBeVisible()
})

test("signed-out visitors are sent to sign in", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/auth\/login/)
})

test("a newcomer gets the welcome page and community cups, not a blank feed", async ({ page, context }) => {
  await signInAs(context, "newbie")
  await page.goto("/")
  await expect(page.getByText("starts with")).toBeVisible()
  await expect(page.getByRole("heading", { name: "around brew" })).toBeVisible()
  await expect(page.getByText("Gibraltar").first()).toBeVisible()
})

test("home shows friends' cups first and the community under its own heading", async ({ page, context }) => {
  await signInAs(context, "maya")
  await page.goto("/")
  await expect(page.getByText("via priya")).toBeVisible() // priya's flat white is the cover
  await expect(page.getByRole("heading", { name: "before that" })).toBeVisible() // sam's 90-day-old cup
  await expect(page.getByRole("heading", { name: "around brew" })).toBeVisible()
  // jonah isn't followed, so his cup only appears in the community section.
  const community = page.locator("section", { has: page.getByRole("heading", { name: "around brew" }) })
  await expect(community.getByText("Gibraltar")).toBeVisible()
})

test("logging a cup asks which was better and slots it into the ranking", async ({ page, context }) => {
  await signInAs(context, "maya")
  await page.goto("/log")
  await page.fill("#drink", "Gibraltar")
  await page.getByRole("button", { name: "at home", exact: true }).click()
  await page.getByRole("button", { name: "log this cup" }).click()

  await expect(page.getByRole("heading", { name: "which was better?" })).toBeVisible()
  // Maya's ladder is 9.2, 8.5, 7.8. Better than the first rival shown, worse than the next.
  await page.getByRole("button", { name: /^this one/ }).click()
  if (await page.getByRole("heading", { name: "which was better?" }).isVisible()) {
    await page.getByRole("button", { name: /^your #/ }).click()
  }
  await expect(page).toHaveURL(/\/review\//)
  await expect(page.getByText(/of your 4 cups/)).toBeVisible()

  await page.goto("/profile?tab=ranked")
  await expect(page.locator("ol li")).toHaveCount(4)
})

test("cheers persist", async ({ page, context }) => {
  await signInAs(context, "maya")
  await page.goto(`/review/${PRIYA_FLAT_WHITE}`)
  const cheers = page.getByRole("button", { name: /cheers/ })
  // The button flips at once (optimistic); wait for the save itself before reloading.
  const saved = page.waitForResponse(r => r.url().includes("/review_votes") && r.request().method() === "POST" && r.ok())
  await cheers.click()
  await expect(cheers).toHaveAttribute("aria-pressed", "true")
  await saved
  await page.reload()
  await expect(page.getByRole("button", { name: /cheers · 1/ })).toHaveAttribute("aria-pressed", "true")
})

test("profile tabs switch in place, without reloading the page", async ({ page, context }) => {
  await signInAs(context, "maya")
  await page.goto("/profile")
  await page.evaluate(() => { (window as unknown as { stayed: boolean }).stayed = true })
  await page.getByRole("tab", { name: "ranked" }).click()
  await expect(page).toHaveURL(/\/profile\?tab=ranked$/)
  await expect(page.getByRole("tabpanel").locator("ol li").first()).toBeVisible()
  await page.getByRole("tab", { name: "cafés" }).click()
  await expect(page.getByRole("tabpanel").getByRole("link", { name: /Sightglass/ })).toBeVisible()
  // Same document the whole time: no navigation, no loading screen.
  expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true)
})

test("reporting a cup", async ({ page, context }) => {
  await signInAs(context, "maya")
  await page.goto(`/review/${PRIYA_FLAT_WHITE}`)
  await page.getByRole("button", { name: "report this cup" }).click()
  await page.getByRole("button", { name: "spam or advertising" }).click()
  await expect(page.getByText("Thanks for telling us")).toBeVisible()
})

test("blocking hides their cups everywhere, and unblocking brings them back", async ({ page, context }) => {
  await signInAs(context, "maya")
  await page.goto("/profile/priya")
  await page.getByRole("button", { name: "More options for @priya" }).click()
  await page.getByRole("button", { name: "block @priya" }).click()
  await page.getByRole("button", { name: "block", exact: true }).click()
  await expect(page.getByText("You blocked @priya")).toBeVisible()

  await page.goto("/")
  await expect(page.getByText("via priya")).toHaveCount(0)
  await page.goto(`/review/${PRIYA_FLAT_WHITE}`)
  await expect(page.getByRole("heading", { name: "nothing brewing here." })).toBeVisible()

  await page.goto("/settings")
  await page.getByRole("button", { name: "unblock" }).click()
  await expect(page.getByText(/^Nobody\./)).toBeVisible()
  await page.goto(`/review/${PRIYA_FLAT_WHITE}`)
  await expect(page.getByRole("heading", { name: "Flat white" })).toBeVisible()
})

test("deleting your account removes you", async ({ browser }) => {
  const leaving = await browser.newContext()
  await signInAs(leaving, "leaving")
  const page = await leaving.newPage()
  await page.goto("/settings")
  await page.getByRole("button", { name: "delete my account…" }).click()
  const confirm = page.getByRole("button", { name: "permanently delete my account" })
  await expect(confirm).toBeDisabled()
  await page.fill("#confirm-delete", "delete")
  await confirm.click()
  await expect(page).toHaveURL(/\/auth\/login/)
  await leaving.close()

  const other = await browser.newContext()
  await signInAs(other, "maya")
  const check = await other.newPage()
  await check.goto("/profile/leaving")
  await expect(check.getByRole("heading", { name: "nothing brewing here." })).toBeVisible()
  await other.close()
})

test.describe("you're at <café>", () => {
  // Sightglass in the seed data is OSM node 1, so a detected pick maps to that row.
  const SIGHTGLASS = { latitude: 37.7766, longitude: -122.4086 }
  const cafe = (id: number, name: string, lat: number, lon: number) =>
    ({ type: "node", id, lat, lon, tags: { amenity: "cafe", name, "addr:city": "San Francisco" } })

  async function atLocation(context: import("@playwright/test").BrowserContext, page: import("@playwright/test").Page, elements: object[]) {
    await context.grantPermissions(["geolocation"])
    await context.setGeolocation({ ...SIGHTGLASS, accuracy: 15 })
    await page.route(/overpass-api\.de/, route => route.fulfill({
      contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ elements }),
    }))
  }

  test("picks the café you're standing in", async ({ page, context }) => {
    await signInAs(context, "maya")
    await atLocation(context, page, [
      cafe(1, "Sightglass", 37.77662, -122.40858),
      cafe(2, "Ritual", 37.7564, -122.4213),
    ])
    await page.goto("/log")
    await expect(page.locator("#cafe")).toHaveValue("Sightglass")
    await expect(page.getByText("looks like you’re here")).toBeVisible()

    await page.fill("#drink", "Cortado")
    await page.getByRole("button", { name: "log this cup" }).click()
    const skip = page.getByRole("button", { name: "skip for now" })
    await skip.click()
    await expect(page).toHaveURL(/\/review\//)
    await expect(page.getByRole("link", { name: /Sightglass/ })).toBeVisible()
  })

  test("'not here?' goes back to the list", async ({ page, context }) => {
    await signInAs(context, "maya")
    await atLocation(context, page, [
      cafe(1, "Sightglass", 37.77662, -122.40858),
      cafe(2, "Ritual", 37.7564, -122.4213),
    ])
    await page.goto("/log")
    await page.getByRole("button", { name: "not here?" }).click()
    await expect(page.locator("#cafe")).toHaveValue("")
    await expect(page.getByText("near you")).toBeVisible()
    await expect(page.getByRole("option")).toHaveCount(2)
  })

  test("doesn't guess when two cafés are side by side", async ({ page, context }) => {
    await signInAs(context, "maya")
    await atLocation(context, page, [
      cafe(1, "Sightglass", 37.77662, -122.40858),
      cafe(3, "Next Door Coffee", 37.77665, -122.40862),
    ])
    await page.goto("/log")
    await expect(page.getByText("near you")).toBeVisible()
    await expect(page.locator("#cafe")).toHaveValue("")
    await expect(page.getByText("looks like you’re here")).toHaveCount(0)
  })
})

test.describe("explore: every café, reviewed or not", () => {
  // Around Sightglass; the fake server serves e2e/scripts/overpass-fixture.json for this area.
  const HERE = { latitude: 37.7766, longitude: -122.4086 }
  const OVERPASS = process.env.OVERPASS_URL ?? "http://localhost:54399/overpass"

  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["geolocation"])
    await context.setGeolocation({ ...HERE, accuracy: 20 })
    // The log screen's own nearby lookup (browser → public Overpass) isn't under test here.
    await context.route(/overpass-api\.de/, route => route.fulfill({
      contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: '{"elements":[]}',
    }))
  })

  test("near you lists unreviewed cafés, and skips bakeries and boba shops tagged as cafés", async ({ page, context }) => {
    await signInAs(context, "maya")
    await page.goto("/explore")
    const near = page.locator("section", { has: page.locator("#near-you") })
    await expect(near.getByRole("link", { name: /Four Barrel Coffee/ })).toContainText("no cups yet · be the first")
    await expect(near.getByRole("link", { name: /Sightglass/ })).toContainText(/cups? logged/)
    await expect(near.getByRole("link", { name: /Starbucks/ })).toContainText("chain")
    await expect(near.getByRole("link", { name: /Réveille Coffee/ })).toContainText("wifi")
    await expect(near.getByText("Crumb & Co Bakery")).toHaveCount(0)
    await expect(near.getByText("Boba Guys")).toHaveCount(0)
  })

  test("'be the first' lists only cafés nobody has logged, with your badge progress", async ({ page, context }) => {
    await signInAs(context, "maya")
    await page.goto("/explore")
    await page.getByRole("tab", { name: /be the first/ }).click()
    const near = page.locator("section", { has: page.locator("#near-you") })
    await expect(near.getByRole("link", { name: /Four Barrel Coffee/ })).toBeVisible()
    await expect(near.getByRole("link", { name: /Sightglass/ })).toHaveCount(0)
    // maya logged the first cup at Sightglass in the seed data.
    await expect(near.getByText("You were first at 1 café")).toBeVisible()
    await expect(near.getByText(/2 more firsts for the scout badge/)).toBeVisible()
    await expect(near.getByRole("listitem", { name: /pioneer.*earned/ })).toBeVisible()
  })

  test("the map names cafés, previews one on tap, and is still there after opening it", async ({ page, context }) => {
    // A blank base map: the pins are what's under test, not the tiles.
    await context.route(/tiles\.openfreemap\.org/, route => route.fulfill({
      contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#f7f3ee" } }] }),
    }))
    await signInAs(context, "maya")
    await page.goto("/explore")
    await page.getByRole("button", { name: "map", exact: true }).click()
    const map = page.getByRole("region", { name: "Map of cafés near you" })
    // Names sit under the pins (reviewed places win when names would overlap).
    await expect(map.getByText("Sightglass", { exact: true })).toBeVisible()


    await map.getByRole("button", { name: "Four Barrel Coffee, no reviews yet" }).click()
    const preview = page.getByRole("link", { name: /Four Barrel Coffee.*be the first/ })
    await expect(preview).toBeVisible()
    await preview.click()
    await expect(page.getByRole("heading", { name: "Four Barrel Coffee" })).toBeVisible()

    await page.getByRole("button", { name: "Back" }).click()
    await expect(page).toHaveURL(/\/explore/)
    await expect(page.getByRole("region", { name: "Map of cafés near you" })).toBeVisible()
    await expect(page.getByRole("link", { name: /Four Barrel Coffee.*be the first/ })).toBeVisible()
    await page.getByRole("button", { name: "Close preview" }).click()
    await expect(page.getByRole("link", { name: /Four Barrel Coffee.*be the first/ })).toHaveCount(0)

    // Pins stay pinned to their places: MapLibre positions them absolutely,
    // and zooming in one level exactly doubles the distance between two pins.
    const back = page.getByRole("region", { name: "Map of cafés near you" })
    const sight = back.getByRole("button", { name: /^Sightglass, / })
    const blue = back.getByRole("button", { name: /^Blue Bottle, / })
    await expect(sight.locator("xpath=..")).toHaveCSS("position", "absolute")
    const gap = async () => {
      const [a, b] = [await sight.boundingBox(), await blue.boundingBox()]
      return Math.hypot(a!.x + a!.width / 2 - (b!.x + b!.width / 2), a!.y + a!.height / 2 - (b!.y + b!.height / 2))
    }
    const before = await gap()
    await back.getByRole("button", { name: "Zoom in" }).click()
    await expect.poll(async () => (await gap()) / before, { timeout: 5000 }).toBeCloseTo(2, 1)
  })

  test("'search this area' loads cafés for wherever the map is, and 'back to near you' returns", async ({ page, context }) => {
    await context.route(/tiles\.openfreemap\.org/, route => route.fulfill({
      contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#f7f3ee" } }] }),
    }))
    await signInAs(context, "maya")
    await page.goto("/explore")
    await page.getByRole("button", { name: "map", exact: true }).click()
    const map = page.getByRole("region", { name: "Map of cafés near you" })
    await expect(map.getByRole("button", { name: /^Sightglass, / })).toBeVisible()
    const searchHere = page.getByRole("button", { name: "search this area" })
    await expect(searchHere).toHaveCount(0)

    await map.getByRole("button", { name: "Zoom out" }).click()
    await expect(searchHere).toBeVisible()
    const request = page.waitForRequest(r => r.url().includes("/api/places/near") && r.url().includes("radius="))
    await searchHere.click()
    await request
    await expect(page.getByText("Showing cafés around the map area")).toBeVisible()
    await expect(searchHere).toHaveCount(0)
    await expect(map.getByRole("button", { name: /^Sightglass, / })).toBeVisible()

    await page.getByRole("button", { name: "back to near you" }).click()
    await expect(page.getByText("Showing cafés around the map area")).toHaveCount(0)
    await expect(page.getByRole("region", { name: "Map of cafés near you" }).getByRole("button", { name: /^Sightglass, / })).toBeVisible()
  })

  test("an area is seeded once, then served from the database", async ({ page, context, request }) => {
    const before = (await (await request.get(`${OVERPASS}/_count`)).json()).count
    await signInAs(context, "maya")
    await page.goto("/explore")
    await expect(page.getByRole("link", { name: /Four Barrel Coffee/ })).toBeVisible()
    const after = (await (await request.get(`${OVERPASS}/_count`)).json()).count
    expect(after).toBe(before)
  })

  test("an unreviewed café has a page, and the first cup claims it", async ({ page, context }) => {
    await signInAs(context, "maya")
    await page.goto("/explore")
    await page.getByRole("link", { name: /Four Barrel Coffee/ }).click()
    await expect(page.getByRole("heading", { name: "Four Barrel Coffee" })).toBeVisible()
    await expect(page.getByText("no cups yet")).toBeVisible()
    await expect(page.getByText("375 Valencia Street")).toBeVisible()

    await page.getByRole("link", { name: "log the first cup" }).click()
    await expect(page.locator("#cafe")).toHaveValue("Four Barrel Coffee")
    await page.fill("#drink", "Pour over")
    await page.getByRole("button", { name: "log this cup" }).click()
    await page.getByRole("button", { name: "skip for now" }).click()
    await expect(page).toHaveURL(/\/review\//)
    await expect(page.getByText("first cup ever logged here")).toBeVisible()
    await expect(page.getByText(/You've been first at 2 cafés · pioneer badge · 1 more for scout/)).toBeVisible()

    await page.getByRole("link", { name: /Four Barrel Coffee/ }).click()
    await expect(page.getByText("first logged by")).toContainText("@maya")
    await expect(page.getByText("no cups yet")).toHaveCount(0)

    await page.goto("/profile")
    await expect(page.getByRole("link", { name: /2\s*firsts/ })).toHaveAttribute("href", "/explore?tab=first")
    await expect(page.getByRole("link", { name: "1 to scout" })).toHaveAttribute("href", "/explore?tab=first")
  })

  test("search finds cafés that aren't on brew yet", async ({ page, context }) => {
    await context.route(/nominatim\.openstreetmap\.org/, route => route.fulfill({
      contentType: "application/json", headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify([{
        osm_type: "node", osm_id: 20, name: "Linea Caffe", lat: "37.7626", lon: "-122.4128",
        display_name: "Linea Caffe, 3417 18th Street, San Francisco",
        address: { house_number: "3417", road: "18th Street", city: "San Francisco", state: "California" },
      }]),
    }))
    await signInAs(context, "maya")
    await page.goto("/explore")
    await page.fill("#q", "Linea")
    await expect(page.getByText("not on brew yet")).toBeVisible()
    await page.getByRole("button", { name: /Linea Caffe/ }).click()
    await expect(page).toHaveURL(/\/place\//)
    await expect(page.getByRole("heading", { name: "Linea Caffe" })).toBeVisible()
    await expect(page.getByText("no cups yet")).toBeVisible()
  })
})
