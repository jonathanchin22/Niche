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
  await cheers.click()
  await expect(cheers).toHaveAttribute("aria-pressed", "true")
  await page.reload()
  await expect(page.getByRole("button", { name: /cheers · 1/ })).toHaveAttribute("aria-pressed", "true")
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
