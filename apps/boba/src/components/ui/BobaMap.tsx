"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"

interface MapPin {
  place_id: string
  name: string
  latitude: number
  longitude: number
  avg_score: number | null
  review_count?: number
}

interface BobaMapProps {
  userLocation: { lat: number; lng: number } | null
  pins?: MapPin[]
  height?: number
  onBoundsChange?: (bounds: {
    north: number
    south: number
    east: number
    west: number
  }) => void
}

export default function BobaMap({
  userLocation,
  pins = [],
  height = 280,
  onBoundsChange,
}: BobaMapProps) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const userMarkerRef = useRef<any>(null)
  const [mapError, setMapError] = useState(false)

  // Initialise the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let maplibre: any
    let map: any

    async function init() {
      try {
        maplibre = await import("maplibre-gl")
        const css = await import("maplibre-gl/dist/maplibre-gl.css" as any)
        void css

        const center: [number, number] = userLocation
          ? [userLocation.lng, userLocation.lat]
          : [-96, 37.8] // continental US fallback

        map = new maplibre.Map({
          container: containerRef.current!,
          style: "https://tiles.openfreemap.org/styles/liberty",
          center,
          zoom: userLocation ? 13 : 4,
          attributionControl: false,
        })

        mapRef.current = map

        map.on("load", () => {
          if (onBoundsChange) {
            const b = map.getBounds()
            onBoundsChange({
              north: b.getNorth(),
              south: b.getSouth(),
              east: b.getEast(),
              west: b.getWest(),
            })
          }
        })

        map.on("moveend", () => {
          if (onBoundsChange) {
            const b = map.getBounds()
            onBoundsChange({
              north: b.getNorth(),
              south: b.getSouth(),
              east: b.getEast(),
              west: b.getWest(),
            })
          }
        })
      } catch {
        setMapError(true)
      }
    }

    init()

    return () => {
      if (map) map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fly to user location when it becomes available
  useEffect(() => {
    if (!mapRef.current || !userLocation) return
    mapRef.current.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: 13,
      speed: 1.4,
    })
  }, [userLocation])

  // Render / update user location dot
  useEffect(() => {
    const map = mapRef.current
    if (!map || !userLocation) return

    const loc = userLocation

    async function addUserMarker() {
      try {
        const maplibre = await import("maplibre-gl")

        if (userMarkerRef.current) {
          userMarkerRef.current.remove()
        }

        const el = document.createElement("div")
        el.style.cssText = `
          width: 16px; height: 16px; border-radius: 50%;
          background: #2d6a4f; border: 3px solid #fff;
          box-shadow: 0 2px 6px rgba(45,106,79,0.5);
        `

        userMarkerRef.current = new maplibre.Marker({ element: el })
          .setLngLat([loc.lng, loc.lat])
          .addTo(map)
      } catch {
        // ignore
      }
    }

    addUserMarker()
  }, [userLocation])

  // Render place pins
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    async function updatePins() {
      try {
        const maplibre = await import("maplibre-gl")

        // Remove old markers
        markersRef.current.forEach(m => m.remove())
        markersRef.current = []

        for (const pin of pins) {
          if (!pin.latitude || !pin.longitude) continue

          const el = document.createElement("div")
          const score = pin.avg_score != null ? pin.avg_score.toFixed(1) : null

          el.style.cssText = `
            display: flex; align-items: center; justify-content: center;
            background: #fff; border: 2px solid #2d6a4f;
            border-radius: 20px; padding: 3px 8px;
            font-family: 'DM Sans', sans-serif; font-size: 11px;
            color: #1a1a1a; white-space: nowrap; cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.12);
            max-width: 120px;
          `
          const shortName = pin.name.split(" ")[0] ?? ""
          el.textContent = score ? `${shortName} ${score}` : shortName
          el.title = pin.name

          el.addEventListener("click", () => {
            router.push(`/place/${pin.place_id}`)
          })

          const marker = new maplibre.Marker({ element: el, anchor: "bottom" })
            .setLngLat([pin.longitude, pin.latitude])
            .addTo(map)

          markersRef.current.push(marker)
        }
      } catch {
        // ignore
      }
    }

    // Wait for map load before adding markers
    if (map.loaded()) {
      updatePins()
    } else {
      map.once("load", updatePins)
    }
  }, [pins, router])

  if (mapError) {
    return (
      <div
        style={{
          height,
          background: "#e8f4ee",
          borderRadius: 12,
          border: "1px solid #e8e8e4",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: "#888",
          }}
        >
          map unavailable
        </span>
      </div>
    )
  }

  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #e8e8e4",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          background: "rgba(255,255,255,0.85)",
          borderRadius: 6,
          padding: "2px 6px",
          fontSize: 9,
          color: "#aaa",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        © OpenStreetMap
      </div>
    </div>
  )
}
