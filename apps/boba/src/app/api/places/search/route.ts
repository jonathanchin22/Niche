import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("query")
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const apiKey = process.env.FOURSQUARE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ results: [] })
  }

  const params = new URLSearchParams({
    query,
    limit: "8",
  })

  if (lat && lng) {
    params.set("ll", `${lat},${lng}`)
    params.set("radius", "15000")
  }

  try {
    const res = await fetch(
      `https://api.foursquare.com/v3/places/search?${params}`,
      {
        headers: {
          // Foursquare Places API v3 uses the raw API key in Authorization (no Bearer prefix)
          Authorization: apiKey,
          Accept: "application/json",
        },
        // Avoid caching stale location results
        cache: "no-store",
      }
    )

    if (!res.ok) {
      return NextResponse.json({ results: [] })
    }

    const data = await res.json()

    const results = (data.results ?? []).map((place: any) => ({
      name: place.name ?? "",
      address: place.location?.formatted_address ?? place.location?.address ?? "",
      city: place.location?.locality ?? place.location?.dma ?? "",
      state: place.location?.region ?? "",
      foursquare_id: place.fsq_id ?? null,
      google_place_id: null as string | null,
      latitude: place.geocodes?.main?.latitude ?? 0,
      longitude: place.geocodes?.main?.longitude ?? 0,
    }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}
