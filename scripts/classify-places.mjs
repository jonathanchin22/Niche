#!/usr/bin/env node
// Refine the rule-based classification of places imported from OpenStreetMap
// with Claude: is it really a coffee place (brew) / bubble tea place (boba),
// what kind (specialty / chain / casual / other), and a few short descriptors.
//
// Env (the job skips cleanly when any are missing):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   write access to places (no user policy allows updates)
//   ANTHROPIC_API_KEY                          Claude API
// Optional: CLASSIFY_LIMIT (default 200 places per run), CLASSIFY_DRY_RUN=1 (print, don't write).
//
// Each place is classified once; afterwards classified_by = 'model' and the
// importer never overwrites it (migration 012).

import Anthropic from "@anthropic-ai/sdk"
import { createClient } from "@supabase/supabase-js"

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
  console.log("classify-places: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and ANTHROPIC_API_KEY are needed — skipping.")
  process.exit(0)
}

const LIMIT = Number(process.env.CLASSIFY_LIMIT ?? 200)
const DRY_RUN = process.env.CLASSIFY_DRY_RUN === "1"
const BATCH = 20

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anthropic = new Anthropic()

const NICHE = {
  brew: {
    what: "coffee",
    relevant: "a place people go to for coffee drinks: cafés, coffee shops, espresso bars, roasters with a bar, and bakeries or restaurants with a real coffee program. Not relevant: places where coffee is incidental (convenience stores, gas stations, ice cream shops, bubble tea shops, pure bakeries).",
    specialty: "third-wave / specialty coffee: roasters, single-origin, pour-over, independent quality-focused shops",
  },
  boba: {
    what: "bubble tea",
    relevant: "a place that sells bubble tea / boba / milk tea drinks. Not relevant: tea rooms or loose-leaf tea retailers without boba, and cafés or restaurants that don't serve bubble tea.",
    specialty: "independent shops known for house-made pearls, fresh fruit or high-quality tea",
  },
}

const SCHEMA = {
  type: "object",
  properties: {
    places: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer" },
          relevant: { type: "boolean" },
          kind: { type: "string", enum: ["specialty", "chain", "casual", "other"] },
          descriptors: { type: "array", items: { type: "string" } },
        },
        required: ["i", "relevant", "kind", "descriptors"],
        additionalProperties: false,
      },
    },
  },
  required: ["places"],
  additionalProperties: false,
}

function prompt(app, batch) {
  const n = NICHE[app]
  const rows = batch.map((p, i) => ({ i, name: p.name, city: p.city || undefined, address: p.address || undefined, tags: p.osm_tags ?? {} }))
  return `You're curating places for a ${n.what} app from OpenStreetMap data. For each place below, decide:

- relevant: true if it's ${n.relevant}
- kind: "chain" for a multi-location brand (the "brand" tag or a well-known chain name), "specialty" for ${n.specialty}, "casual" for other relevant places, "other" when not relevant.
- descriptors: up to 4 short lowercase phrases a customer would find useful (e.g. "roaster", "wifi", "outdoor seating", "late night", "pastries"). Only use what the name and tags support; return an empty list rather than guessing.

When the data is too thin to tell, keep it relevant with kind "casual" — hiding a real ${n.what} place is worse than showing a borderline one.

Return one entry per place, using its "i".

Places:
${JSON.stringify(rows, null, 1)}`
}

async function classify(app, batch) {
  const response = await anthropic.beta.messages.create({
    model: "claude-opus-5",
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: prompt(app, batch) }],
  })
  if (response.stop_reason === "refusal") {
    console.warn(`classify-places: refused (${response.stop_details?.category ?? "unknown"}), skipping ${batch.length} places`)
    return []
  }
  if (response.stop_reason === "max_tokens") {
    console.warn(`classify-places: output cut off, skipping ${batch.length} places`)
    return []
  }
  const text = response.content.find(b => b.type === "text")?.text
  if (!text) return []
  const parsed = JSON.parse(text)
  return parsed.places
    .filter(r => Number.isInteger(r.i) && r.i >= 0 && r.i < batch.length)
    .map(r => ({
      id: batch[r.i].id,
      name: batch[r.i].name,
      relevant: !!r.relevant,
      kind: r.kind,
      descriptors: (r.descriptors ?? []).map(d => String(d).toLowerCase().slice(0, 32)).slice(0, 4),
    }))
}

const { data: pending, error } = await supabase
  .from("places")
  .select("id, app_id, name, address, city, osm_tags")
  .eq("source", "osm")
  .or("classified_by.is.null,classified_by.eq.rules")
  .order("created_at", { ascending: true })
  .limit(LIMIT)
if (error) throw error
console.log(`classify-places: ${pending.length} places to classify${DRY_RUN ? " (dry run)" : ""}`)

let done = 0
for (const app of Object.keys(NICHE)) {
  const places = pending.filter(p => p.app_id === app)
  for (let i = 0; i < places.length; i += BATCH) {
    const batch = places.slice(i, i + BATCH)
    let results = []
    try {
      results = await classify(app, batch)
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) { console.warn("classify-places: rate limited, stopping this run"); break }
      if (e instanceof Anthropic.APIError) { console.warn(`classify-places: API error ${e.status}, skipping batch`); continue }
      if (e instanceof SyntaxError) { console.warn("classify-places: couldn't parse a response, skipping batch"); continue }
      throw e
    }
    for (const r of results) {
      if (DRY_RUN) { console.log(`${app}  ${r.relevant ? "✓" : "✗"} ${r.kind.padEnd(9)} ${r.name}  [${r.descriptors.join(", ")}]`); continue }
      const { error: updateError } = await supabase
        .from("places")
        .update({ relevant: r.relevant, kind: r.kind, descriptors: r.descriptors, classified_by: "model", classified_at: new Date().toISOString() })
        .eq("id", r.id)
      if (updateError) console.warn(`classify-places: couldn't update ${r.name}: ${updateError.message}`)
      else done++
    }
  }
}
console.log(`classify-places: ${DRY_RUN ? "dry run finished" : `classified ${done} places`}`)
