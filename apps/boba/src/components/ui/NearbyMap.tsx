"use client"

import { useState } from "react"
import Map, { Marker, NavigationControl, AttributionControl } from "react-map-gl/maplibre"
import "maplibre-gl/dist/maplibre-gl.css"

export interface PlacePin {
  id: string
  name: string
  latitude: number
  longitude: number
  avg_score?: number | null
  review_count?: number
}

interface NearbyMapProps {
  pins: PlacePin[]
  userLocation?: { lat: number; lng: number } | null
  onPinClick?: (id: string) => void
  height?: number
  initialCenter?: { lat: number; lng: number }
  initialZoom?: number
}

// Free OpenStreetMap tile style — no API key required
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
    },
  },
  layers: [{ id: "osm-tiles", type: "raster", source: "osm" }],
} as const

export default function NearbyMap({
  pins,
  userLocation,
  onPinClick,
  height = 240,
  initialCenter,
  initialZoom = 13,
}: NearbyMapProps) {
  const [activePin, setActivePin] = useState<string | null>(null)

  const center = userLocation
    ? { longitude: userLocation.lng, latitude: userLocation.lat }
    : initialCenter
    ? { longitude: initialCenter.lng, latitude: initialCenter.lat }
    : pins.length > 0
    ? { longitude: pins[0].longitude, latitude: pins[0].latitude }
    : { longitude: -122.4, latitude: 37.78 } // Default: San Francisco

  return (
    <div style={{ position: "relative", height, borderRadius: 12, overflow: "hidden", border: "1px solid #e8e8e4" }}>
      <Map
        initialViewState={{
          longitude: center.longitude,
          latitude: center.latitude,
          zoom: initialZoom,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={OSM_STYLE as any}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <AttributionControl compact position="bottom-right" />

        {/* User location marker */}
        {userLocation && (
          <Marker longitude={userLocation.lng} latitude={userLocation.lat}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#3b82f6",
                border: "3px solid #fff",
                boxShadow: "0 0 0 2px #3b82f6",
              }}
              title="Your location"
            />
          </Marker>
        )}

        {/* Place pins */}
        {pins.map((pin) => {
          if (!pin.latitude || !pin.longitude) return null
          const isActive = activePin === pin.id
          return (
            <Marker
              key={pin.id}
              longitude={pin.longitude}
              latitude={pin.latitude}
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                setActivePin(isActive ? null : pin.id)
                onPinClick?.(pin.id)
              }}
            >
              <div
                style={{
                  width: isActive ? 32 : 26,
                  height: isActive ? 32 : 26,
                  borderRadius: "50%",
                  background: isActive ? "#1a4d38" : "#2d6a4f",
                  border: "2px solid #fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: isActive ? 13 : 11,
                  color: "#fff",
                  transition: "all 0.15s ease",
                  zIndex: isActive ? 10 : 1,
                }}
                title={pin.name}
              >
                ✦
              </div>
            </Marker>
          )
        })}
      </Map>
    </div>
  )
}
