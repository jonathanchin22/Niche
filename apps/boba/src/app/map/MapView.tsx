"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { MapContainer, TileLayer, CircleMarker, Popup, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import { createClient } from "@niche/auth/client"
import { getMapPins } from "@niche/database"
import { AppShell } from "@/components/ui/AppShell"

const FALLBACK_CENTER: [number, number] = [40.7128, -74.006]

type Bounds = { north: number; south: number; east: number; west: number }

function BoundsWatcher({ onBoundsChange }: { onBoundsChange: (bounds: Bounds) => void }) {
  const toBounds = () => {
    const bounds = map.getBounds()
    onBoundsChange({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
  }

  const map = useMapEvents({
    load: toBounds,
    moveend: toBounds,
    zoomend: toBounds,
  })

  useEffect(() => {
    toBounds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

function normalizePin(pin: any) {
  const place = pin.place ?? null

  if (place) {
    return {
      id: place.id,
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      friendCount: Number(pin.friend_count ?? 0),
      topScore: pin.top_score ?? null,
    }
  }

  return {
    id: pin.place_id,
    name: pin.name,
    lat: pin.latitude,
    lng: pin.longitude,
    friendCount: 0,
    topScore: pin.avg_score ?? null,
  }
}

export default function MapView() {
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState("")
  const [center, setCenter] = useState<[number, number]>(FALLBACK_CENTER)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const [pins, setPins] = useState<any[]>([])
  const [status, setStatus] = useState<"requesting" | "granted" | "fallback">("requesting")
  const [isLoadingPins, setIsLoadingPins] = useState(false)

  useEffect(() => {
    let active = true

    const init = async () => {
      if (!supabase?.auth?.getUser) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      setUserId(user?.id ?? "")

      if (!navigator.geolocation) {
        setStatus("fallback")
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!active) return
          setCenter([position.coords.latitude, position.coords.longitude])
          setStatus("granted")
        },
        () => {
          if (!active) return
          setStatus("fallback")
          setCenter(FALLBACK_CENTER)
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
      )
    }

    void init()

    return () => {
      active = false
    }
  }, [supabase])

  useEffect(() => {
    let active = true

    const loadPins = async () => {
      if (!userId || !bounds) return
      setIsLoadingPins(true)
      try {
        const rows = await getMapPins(supabase as any, {
          app_id: "boba",
          user_id: userId,
          bounds,
        })

        if (!active) return
        setPins((rows as any[]).map(normalizePin).filter((p) => p.id && p.lat != null && p.lng != null))
      } finally {
        if (active) setIsLoadingPins(false)
      }
    }

    void loadPins()
    return () => {
      active = false
    }
  }, [bounds, supabase, userId])

  return (
    <AppShell activeTab="map">
      <div style={{ padding: "52px 16px 20px" }}>
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: 15, color: "#888", margin: "0 0 4px" }}>
          nearby spots
        </p>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 30,
          color: "#1a1a1a",
          margin: "0 0 14px",
          fontWeight: 400,
        }}>
          map
        </h1>

        {status === "requesting" && (
          <div style={{
            marginBottom: 10,
            border: "1px dashed #d8ddd8",
            borderRadius: 10,
            background: "#fff",
            padding: "9px 12px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "#7f857f",
          }}>
            requesting your location to show nearby boba spots...
          </div>
        )}

        {status === "fallback" && (
          <div style={{
            marginBottom: 10,
            border: "1px dashed #d8ddd8",
            borderRadius: 10,
            background: "#fff",
            padding: "9px 12px",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "#7f857f",
          }}>
            location unavailable, showing a default city view.
          </div>
        )}

        <div style={{
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid #e2e7e2",
          background: "#fff",
        }}>
          <MapContainer center={center} zoom={13} style={{ width: "100%", height: 440 }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <BoundsWatcher onBoundsChange={setBounds} />

            {pins.map((pin) => (
              <CircleMarker
                key={pin.id}
                center={[pin.lat, pin.lng]}
                radius={8}
                pathOptions={{ color: "#2d6a4f", fillColor: "#2d6a4f", fillOpacity: 0.78, weight: 2 }}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>{pin.name}</p>
                    {pin.topScore != null && (
                      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#5e665e" }}>
                        top score: {(Number(pin.topScore) / 2).toFixed(1)} / 5
                      </p>
                    )}
                    <Link href={`/place/${pin.id}`} style={{ fontSize: 12, color: "#2d6a4f", textDecoration: "none" }}>
                      open place →
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>

        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#878c87" }}>
            {isLoadingPins ? "refreshing map pins..." : `${pins.length} spots in view`}
          </span>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#97a097", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            drag map to update
          </span>
        </div>
      </div>
    </AppShell>
  )
}