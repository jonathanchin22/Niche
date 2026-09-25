"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import type { Map as MapLibreMap } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

/** A pin: reviewed places show their score; unreviewed ones a quiet dot. */
export interface MapPin { id: string; name: string; lat: number; lng: number; score: number | null; href: string }

// The base map, recoloured to match the app: cream paper, ink labels, soft greens.
const THEME = {
  background: "#f7f3ee",
  water: "#dfe4df",
  park: "#ebe8d8",
  landuse: "#f2ede4",
  building: "#ece5d8",
  roadMajor: "#ffffff",
  roadMinor: "#fbf8f3",
  roadCasing: "#e4dccd",
  rail: "#ddd4c2",
  label: "#6b5c4a",
  halo: "#f7f3ee",
  pin: "#1c1410",
  pinText: "#faf8f4",
  dot: "#7d6858",
}

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron"

function recolor(map: MapLibreMap) {
  for (const layer of map.getStyle().layers ?? []) {
    const id = layer.id
    try {
      if (layer.type === "background") map.setPaintProperty(id, "background-color", THEME.background)
      else if (layer.type === "fill") {
        const color = /water/.test(id) ? THEME.water
          : /park|wood|grass|glacier/.test(id) ? THEME.park
          : /building/.test(id) ? THEME.building
          : THEME.landuse
        map.setPaintProperty(id, "fill-color", color)
      } else if (layer.type === "line") {
        const color = /water/.test(id) ? THEME.water
          : /rail/.test(id) ? THEME.rail
          : /casing/.test(id) ? THEME.roadCasing
          : /major|motorway/.test(id) ? THEME.roadMajor
          : /highway|road|path/.test(id) ? THEME.roadMinor
          : THEME.roadCasing
        map.setPaintProperty(id, "line-color", color)
      } else if (layer.type === "symbol") {
        if (/shield/.test(id)) map.setLayoutProperty(id, "visibility", "none")
        else {
          map.setPaintProperty(id, "text-color", THEME.label)
          map.setPaintProperty(id, "text-halo-color", THEME.halo)
        }
      }
    } catch {
      // A layer without that paint property; leave it.
    }
  }
}

function pinElement(pin: MapPin) {
  const el = document.createElement("button")
  el.type = "button"
  el.setAttribute("aria-label", pin.score != null ? `${pin.name}, ${pin.score.toFixed(1)}` : `${pin.name}, no cups yet`)
  if (pin.score != null) {
    el.textContent = pin.score.toFixed(1)
    Object.assign(el.style, {
      padding: "3px 7px", borderRadius: "999px", border: "none", cursor: "pointer",
      background: THEME.pin, color: THEME.pinText, font: "600 12px var(--font-mono, monospace)",
      boxShadow: "0 1px 3px rgba(28,20,16,.25)",
    })
  } else {
    Object.assign(el.style, {
      width: "12px", height: "12px", borderRadius: "50%", cursor: "pointer", padding: "0",
      background: THEME.halo, border: `2px solid ${THEME.dot}`,
    })
  }
  return el
}

/**
 * Cafés on a map (MapLibre + OpenFreeMap tiles, no API key). MapLibre is
 * loaded only when this mounts, so it never weighs down the list view.
 */
export default function CafeMap({ center, pins, height = 420, showMe = true, zoom = 14.5 }: {
  center: { lat: number; lng: number }
  pins: MapPin[]
  height?: number
  /** The blue "you are here" dot at the centre (off on a café's own page). */
  showMe?: boolean
  zoom?: number
}) {
  const router = useRouter()
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: MapLibreMap | null = null
    let cancelled = false
    ;(async () => {
      const maplibregl = (await import("maplibre-gl")).default
      if (cancelled || !container.current) return
      map = new maplibregl.Map({
        container: container.current,
        style: STYLE_URL,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
      })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
      map.on("style.load", () => map && recolor(map))
      // Start the credits collapsed to an (i); the full line is shown under the map.
      map.on("load", () => container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"))

      if (showMe) {
        const me = document.createElement("span")
        Object.assign(me.style, { width: "14px", height: "14px", borderRadius: "50%", background: "#3b82f6", border: "3px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.15)" })
        new maplibregl.Marker({ element: me }).setLngLat([center.lng, center.lat]).addTo(map)
      }

      for (const pin of pins) {
        const el = pinElement(pin)
        el.addEventListener("click", () => router.push(pin.href))
        new maplibregl.Marker({ element: el }).setLngLat([pin.lng, pin.lat]).addTo(map)
      }
    })()
    return () => { cancelled = true; map?.remove() }
  }, [center.lat, center.lng, pins, router, showMe, zoom])

  return <div ref={container} role="region" aria-label="Map of cafés near you" style={{ height, borderRadius: 2, overflow: "hidden", background: THEME.background }} />
}
