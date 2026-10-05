#!/usr/bin/env node
// Turn an Overture export (scripts/overture/export.py) into import batches for
// import_overture_places() (migration 014), one set per app.
//
//   node scripts/overture/prepare.mjs overture-oc.json out-dir/
//
// Places are classified with the same rules as OpenStreetMap imports
// (packages/database/src/catalog.ts), low-confidence and closed places are
// dropped, and duplicates within the export (same name, within 60 m) are merged.
// Each batch is a JSON array of rows (up to 250); out-dir/summary.json has counts and a checksum per
// app to compare with the database after importing.

import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import ts from "typescript"

const [input, outDir] = process.argv.slice(2)
if (!input || !outDir) {
  console.error("usage: node scripts/overture/prepare.mjs <export.json> <out-dir>")
  process.exit(1)
}

// The classifier is TypeScript; transpile it (and what it imports) on the fly.
const src = join(dirname(fileURLToPath(import.meta.url)), "../../packages/database/src")
const tmp = mkdtempSync(join(tmpdir(), "overture-"))
for (const name of ["catalog", "nearby"]) {
  const code = ts.transpileModule(readFileSync(join(src, `${name}.ts`), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"')
  writeFileSync(join(tmp, `${name}.mjs`), code)
}
const { classifyOsmPlace } = await import(pathToFileURL(join(tmp, "catalog.mjs")).href)

const MIN_CONFIDENCE = 0.6
const BATCH = 250
const COFFEE = new Set(["coffee_shop", "cafe", "coffee_roastery", "espresso_bar"])

// Overture's café categories are noisy (diners, a laundromat, a jeans shop…).
// Coffee places need a coffee word in the name, or be a very confident
// coffee_shop/roastery listing, or a known chain (the classifier's call).
const COFFEE_WORDS = /coff|koff|\bcaf|kafe|caff|espresso|roast|brew|bean|java|latte|kopi|grind|barista|perk|cuppa|\bcup\b|\bmugs?\b|drip|c[aà] ?ph[eê]|matcha/i
const NOT_A_CAFE = /hard rock|mimi'?s caf|eat chow|urbane caf|blueberry hill|^warner$|diner|grill|chicken|burger|pizza|taco|barber|laund|jeans|fajas|cowork|dining services|mcdonald|farmer bros|coffee service|international|catering|market\b/i

const titleCase = s => (s ?? "").toLowerCase().replace(/\b\p{L}/gu, c => c.toUpperCase())
const norm = s => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim()
const metres = (a, b) => {
  const r = 6371000, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

// Overture categories, as the OSM tags the classifier understands.
function asTags(p, app) {
  const tags = { name: p.name, amenity: "cafe" }
  if (p.brand) tags.brand = p.brand
  if (p.category === "coffee_roastery") tags.craft = "roaster"
  if (p.category === "bubble_tea_shop") tags.cuisine = "bubble_tea"
  // A tea room is only boba by name; a café is only coffee if it isn't bubble tea.
  if (app === "brew" && !COFFEE.has(p.category)) return null
  if (app === "boba" && !["bubble_tea_shop", "tea_room", "cafe", "coffee_shop"].includes(p.category)) return null
  return tags
}

const all = JSON.parse(readFileSync(input, "utf8"))
  .filter(p => p.name && p.confidence >= MIN_CONFIDENCE && p.operating_status !== "permanently_closed")
  .sort((a, b) => b.confidence - a.confidence)

mkdirSync(outDir, { recursive: true })
const summary = {}
for (const app of ["brew", "boba"]) {
  const kept = []
  for (const p of all) {
    const tags = asTags(p, app)
    if (!tags) continue
    const c = classifyOsmPlace(app === "brew" ? "cafe" : "boba", tags)
    if (!c.relevant) continue
    if (app === "brew" && NOT_A_CAFE.test(p.name)) continue
    if (app === "brew" && c.kind !== "chain") {
      const sure = ["coffee_shop", "coffee_roastery"].includes(p.category) && p.confidence >= 0.95
      if (!COFFEE_WORDS.test(p.name) && !sure) continue
    }
    const place = {
      id: `ovm_${p.id}`,
      name: p.name.trim().slice(0, 120),
      address: (p.address ?? "").trim(),
      city: titleCase(p.city),
      state: p.state ?? "",
      lat: Number(Number(p.lat).toFixed(6)),
      lng: Number(Number(p.lng).toFixed(6)),
      kind: c.kind,
      descriptors: c.descriptors,
    }
    // The same place listed twice (sources disagree slightly): keep the surer one.
    if (kept.some(k => norm(k.name) === norm(place.name) && metres(k, place) < 60)) continue
    kept.push(place)
  }
  kept.sort((a, b) => a.id.localeCompare(b.id))
  for (let i = 0; i * BATCH < kept.length; i++) {
    // Rows as import_overture_places() takes them: [id, name, address, city, state, lat, lng, kind, descriptors].
    const rows = kept.slice(i * BATCH, (i + 1) * BATCH)
      .map(p => [p.id, p.name, p.address, p.city, p.state, p.lat, p.lng, p.kind, p.descriptors])
    writeFileSync(join(outDir, `${app}-${i + 1}.json`), JSON.stringify(rows))
  }
  // Checksum over what the database stores, to verify an import end to end.
  const canonical = kept.map(p => [p.id, p.name, p.lat.toFixed(6), p.lng.toFixed(6)].join("|")).join("\n")
  summary[app] = {
    places: kept.length,
    batches: Math.ceil(kept.length / BATCH),
    kinds: kept.reduce((m, p) => ({ ...m, [p.kind]: (m[p.kind] ?? 0) + 1 }), {}),
    md5: createHash("md5").update(canonical).digest("hex"),
  }
}
writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2))
console.log(summary)
