"use client"

// TasteProfile.tsx — boba-specific taste fingerprint display
// Shown on the user profile page under their review stats.

interface BobaTasteProfile {
  total_reviews: number
  revisit_rate: number | null
  top_drink_type: string | null
  avg_sugar_level: number | null
  preferred_ice: string | null
  score_stddev: number | null
  avg_score_given: number | null
  top_toppings: string[] | null
}

interface TasteProfileProps {
  profile: BobaTasteProfile
  reviewCount: number
}

const DRINK_EMOJIS: Record<string, string> = {
  "milk tea":       "🥛",
  "fruit tea":      "🍊",
  "taro":           "💜",
  "matcha":         "🍵",
  "brown sugar":    "🐯",
  "cheese foam":    "🧀",
  "yakult":         "🍶",
  "smoothie":       "🥤",
  "seasonal special": "✨",
}

const TOPPING_EMOJIS: Record<string, string> = {
  "classic boba":  "⚫",
  "tiger pearls":  "🟤",
  "popping boba":  "🫧",
  "lychee jelly":  "🌸",
  "grass jelly":   "🖤",
  "pudding":       "🟡",
  "red bean":      "🔴",
  "aloe vera":     "💚",
  "coconut jelly": "🤍",
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#f4f4f0",
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flex: 1,
        minWidth: 80,
      }}
    >
      <span
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 22,
          fontWeight: 400,
          color: "#1a1a1a",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          color: "#aaa",
          lineHeight: 1.3,
        }}
      >
        {label}
      </span>
    </div>
  )
}

function SugarBar({ value }: { value: number }) {
  // value 0–100
  const label =
    value <= 10 ? "unsweetened" :
    value <= 30 ? "lightly sweet" :
    value <= 55 ? "half sweet" :
    value <= 80 ? "mostly sweet" :
    "full sugar"

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: "#666",
          }}
        >
          sweetness preference
        </span>
        <span
          style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 14,
            color: "#1a1a1a",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "#e8e8e4",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            background: "linear-gradient(90deg, #ff6b6b, #ffd93d, #6bcf7f)",
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  )
}

function TopToppings({ toppings }: { toppings: string[] }) {
  if (!toppings || toppings.length === 0) return null

  return (
    <div>
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13,
          color: "#666",
          marginBottom: 8,
        }}
      >
        favorite toppings
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {toppings.slice(0, 5).map((topping, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 20 }}>{TOPPING_EMOJIS[topping] || "🍡"}</span>
            <span
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 10,
                color: "#888",
                textAlign: "center",
              }}
            >
              {topping}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TasteProfile({ profile, reviewCount }: TasteProfileProps) {
  if (reviewCount < 3) {
    return (
      <div
        style={{
          background: "#f4f4f0",
          borderRadius: 12,
          padding: 20,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize: 16,
            color: "#888",
            marginBottom: 8,
          }}
        >
          taste profile
        </div>
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: "#aaa",
          }}
        >
          log {3 - reviewCount} more review{3 - reviewCount === 1 ? "" : "s"} to see your taste fingerprint
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: "#f4f4f0",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div
        style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 18,
          color: "#1a1a1a",
          marginBottom: 16,
        }}
      >
        taste profile
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <StatPill
          label="reviews"
          value={profile.total_reviews.toString()}
        />
        <StatPill
          label="revisit rate"
          value={profile.revisit_rate ? `${Math.round(profile.revisit_rate * 100)}%` : "—"}
        />
        <StatPill
          label="avg rating"
          value={profile.avg_score_given ? (profile.avg_score_given / 2).toFixed(1) : "—"}
        />
      </div>

      {profile.top_drink_type && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: "#666",
              marginBottom: 8,
            }}
          >
            favorite drink
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 24 }}>
              {DRINK_EMOJIS[profile.top_drink_type] || "🍵"}
            </span>
            <span
              style={{
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontSize: 16,
                color: "#1a1a1a",
              }}
            >
              {profile.top_drink_type}
            </span>
          </div>
        </div>
      )}

      {profile.avg_sugar_level !== null && (
        <div style={{ marginBottom: 16 }}>
          <SugarBar value={profile.avg_sugar_level} />
        </div>
      )}

      {profile.preferred_ice && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: "#666",
              marginBottom: 8,
            }}
          >
            ice preference
          </div>
          <div
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: 16,
              color: "#1a1a1a",
            }}
          >
            {profile.preferred_ice}
          </div>
        </div>
      )}

      <TopToppings toppings={profile.top_toppings || []} />
    </div>
  )
}