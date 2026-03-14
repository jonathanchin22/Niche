-- ============================================================
-- NICHE — Boba taste attributes migration
-- Migration: 004_boba_taste_attributes
-- Adds structured taste data to reviews for the recommendation engine
-- ============================================================

-- Add new columns to reviews table
alter table reviews
  add column if not exists taste_attributes  jsonb,
  add column if not exists customizations    text[]    not null default '{}',
  add column if not exists toppings          text[]    not null default '{}',
  add column if not exists quality_signals   jsonb,
  add column if not exists visit_context     text,
  add column if not exists revisit_intent    boolean,
  add column if not exists price_paid        numeric(5,2);

-- Validate visit_context values
alter table reviews
  add constraint visit_context_values check (
    visit_context is null or visit_context in (
      'solo', 'date', 'group', 'work', 'takeout', 'delivery'
    )
  );

-- Index taste_attributes for fast querying (e.g. filter by sugar_level)
create index if not exists reviews_taste_attributes_idx
  on reviews using gin(taste_attributes);

create index if not exists reviews_toppings_idx
  on reviews using gin(toppings);

create index if not exists reviews_customizations_idx
  on reviews using gin(customizations);

-- ─── Boba taste_attributes shape (for reference, not enforced by DB) ─────────
-- {
--   "drink_type":    "milk tea" | "fruit tea" | "matcha" | "taro" | "brown sugar"
--                    | "cheese foam" | "yakult" | "smoothie" | "seasonal special",
--   "sugar_level":   0 | 25 | 50 | 75 | 100,
--   "ice_level":     "no ice" | "less" | "regular" | "extra",
--   "pearl_texture": "perfect chew" | "too soft" | "too hard" | "overcooked" | null,
--   "tea_base":      "real tea" | "powdery" | "artificial" | null
-- }

-- ─── quality_signals shape (for reference) ──────────────────────────────────
-- {
--   "pearls":   1-5 integer rating,
--   "tea_base": 1-5 integer rating,
--   "sweetness_accuracy": 1-5 integer rating  (did they nail your sugar level?)
-- }