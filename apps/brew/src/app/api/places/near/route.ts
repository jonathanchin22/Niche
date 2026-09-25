import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "@niche/auth/server"
import { getNearbyCatalog } from "@niche/database"
import { APP_ID } from "@/lib/brew"

export const dynamic = "force-dynamic"

/**
 * Places near a point, reviewed or not. The first request for an area seeds
 * it from OpenStreetMap (see packages/database/src/catalog.ts).
 * OVERPASS_URL overrides the Overpass endpoint (tests point it at a fixture).
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getServerSession()
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 })

  const lat = Number(request.nextUrl.searchParams.get("lat"))
  const lng = Number(request.nextUrl.searchParams.get("lng"))
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 })
  }

  try {
    const result = await getNearbyCatalog(supabase, {
      app_id: APP_ID,
      niche: "cafe",
      at: { lat, lng },
      overpassEndpoints: process.env.OVERPASS_URL ? [process.env.OVERPASS_URL] : undefined,
    })
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=60" } })
  } catch (error) {
    console.error("places/near failed:", error)
    return NextResponse.json({ error: "Couldn't load places near you" }, { status: 500 })
  }
}
