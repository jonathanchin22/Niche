"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { Map as MapLibreMap, Marker } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

/** A pin: reviewed places show their score; unreviewed ones a quiet dot. */
export interface MapPin { id: string; name: string; lat: number; lng: number; score: number | null; href: string }

// The base map, recoloured to match the app: rice paper, leaf labels, jade pins.
const THEME = {
  background: "#f6f3ec",
  water: "#d6e6dc",
  park: "#e3eee7",
  landuse: "#f1ede3",
  building: "#ebe5d6",
  roadMajor: "#ffffff",
  roadMinor: "#fbf9f4",
  roadCasing: "#e2dccd",
  rail: "#dbd6c8",
  label: "#56615a",
  halo: "#f6f3ec",
  pin: "#2d6a4f",
  pinText: "#fcfbf7",
  dot: "#56615a",
}

// MapLibre, loaded on demand.
const loadMapLibre = async () => (await import("maplibre-gl")).default
type MapLibre = Awaited<ReturnType<typeof loadMapLibre>>

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
  // MapLibre positions the marker element itself (position: absolute plus a
  // transform); don't override its position, or pins drift off their spot as
  // you pan and zoom. The pin sets the element's size; the name hangs below it.
  const wrap = document.createElement("div")
  Object.assign(wrap.style, { display: "flex", justifyContent: "center" })
  const el = document.createElement("button")
  el.type = "button"
  el.setAttribute("aria-label", pin.score != null ? `${pin.name}, ${pin.score.toFixed(1)}` : `${pin.name}, no reviews yet`)
  if (pin.score != null) {
    el.textContent = pin.score.toFixed(1)
    Object.assign(el.style, {
      padding: "3px 7px", borderRadius: "999px", border: "none", cursor: "pointer",
      background: THEME.pin, color: THEME.pinText, font: "600 12px var(--font-mono, monospace)",
      boxShadow: "0 1px 3px rgba(28,20,16,.25)", transition: "transform .15s",
    })
  } else {
    Object.assign(el.style, {
      width: "14px", height: "14px", borderRadius: "50%", cursor: "pointer", padding: "0",
      background: THEME.halo, border: `2px solid ${THEME.dot}`, transition: "transform .15s",
    })
  }
  // The name, under the pin; shown once you're zoomed in enough to read it.
  const label = document.createElement("span")
  label.textContent = pin.name.length > 22 ? `${pin.name.slice(0, 21)}…` : pin.name
  Object.assign(label.style, {
    position: "absolute", top: "calc(100% + 2px)", left: "50%", transform: "translateX(-50%)",
    whiteSpace: "nowrap", pointerEvents: "none", font: "600 11px/1.2 var(--font-sans, system-ui)",
    color: THEME.label, textShadow: `0 0 3px ${THEME.halo}, 0 0 3px ${THEME.halo}, 0 0 2px ${THEME.halo}`,
  })
  wrap.append(el, label)
  return { wrap, button: el, label }
}

export interface MapCamera { lat: number; lng: number; zoom: number }

/** Below this zoom the map is too crowded for names at all. */
const LABEL_MIN_ZOOM = 12

/**
 * Shops on a map (MapLibre + OpenFreeMap tiles, no API key). MapLibre is
 * loaded only when this mounts, so it never weighs down the list view.
 * With `onSelect`, tapping a pin selects it (the page shows a preview);
 * without it, tapping opens the shop.
 */
export default function CafeMap({ center, pins, height = 420, showMe = true, zoom = 14.5, camera, onCameraChange, selectedId, onSelect }: {
  center: { lat: number; lng: number }
  pins: MapPin[]
  height?: number
  /** The blue "you are here" dot at the centre (off on a café's own page). */
  showMe?: boolean
  zoom?: number
  /** Where to open the map instead of center/zoom (e.g. where you left it). */
  camera?: MapCamera | null
  onCameraChange?: (camera: MapCamera) => void
  selectedId?: string | null
  onSelect?: (id: string | null) => void
}) {
  const router = useRouter()
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const libRef = useRef<MapLibre | null>(null)
  const [ready, setReady] = useState(false)
  const markers = useRef(new Map<string, { marker: Marker; button: HTMLButtonElement; label: HTMLSpanElement; reviewed: boolean }>())
  // Latest callbacks, so the map doesn't rebuild when a parent re-renders.
  const cb = useRef({ onSelect, onCameraChange, router })
  cb.current = { onSelect, onCameraChange, router }
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  // Opened fresh (no saved camera): frame you and the closest places once.
  const framed = useRef(!!camera)

  const styleMarkers = () => {
    const map = mapRef.current
    if (!map) return
    const z = map.getZoom()
    const entries = [...markers.current.entries()]
    for (const [id, m] of entries) {
      const selected = id === selectedRef.current
      m.label.style.fontSize = selected ? "12px" : "11px"
      m.button.style.transform = selected ? "scale(1.35)" : ""
      m.marker.getElement().style.zIndex = selected ? "2" : m.reviewed ? "1" : ""
      m.label.style.display = selected || z >= LABEL_MIN_ZOOM ? "" : "none"
    }
    // Names that would overlap a more important one are hidden: the selected
    // place first, then reviewed places, then the nearest (pins come nearest first).
    const rank = (id: string, reviewed: boolean) => (id === selectedRef.current ? 0 : reviewed ? 1 : 2)
    // Pins are obstacles too: a name shouldn't sit under another café's pin.
    const kept: DOMRect[] = entries.map(([, m]) => m.button.getBoundingClientRect())
    for (const [id, m] of entries.sort((a, b) => rank(a[0], a[1].reviewed) - rank(b[0], b[1].reviewed))) {
      if (m.label.style.display === "none") continue
      const r = m.label.getBoundingClientRect()
      const hit = kept.some(k => r.left < k.right + 4 && r.right > k.left - 4 && r.top < k.bottom + 2 && r.bottom > k.top - 2)
      if (hit && id !== selectedRef.current) m.label.style.display = "none"
      else kept.push(r)
    }
  }

  // The map itself, created once.
  useEffect(() => {
    let map: MapLibreMap | null = null
    let cancelled = false
    const pinMarkers = markers.current
    ;(async () => {
      const maplibregl = await loadMapLibre()
      if (cancelled || !container.current) return
      libRef.current = maplibregl
      const start = camera ?? { lat: center.lat, lng: center.lng, zoom }
      map = new maplibregl.Map({
        container: container.current,
        style: STYLE_URL,
        center: [start.lng, start.lat],
        zoom: start.zoom,
        attributionControl: { compact: true },
      })
      mapRef.current = map
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
      map.on("style.load", () => map && recolor(map))
      // Start the credits collapsed to an (i); the full line is shown under the map.
      map.on("load", () => container.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show"))
      map.on("moveend", styleMarkers)
      map.on("moveend", () => {
        if (!map) return
        const c = map.getCenter()
        cb.current.onCameraChange?.({ lat: c.lat, lng: c.lng, zoom: map.getZoom() })
      })
      // Tapping empty map closes the preview.
      map.on("click", e => {
        if ((e.originalEvent.target as Element | null)?.closest?.(".maplibregl-marker")) return
        cb.current.onSelect?.(null)
      })

      if (showMe) {
        const me = document.createElement("span")
        Object.assign(me.style, { width: "14px", height: "14px", borderRadius: "50%", background: "#3b82f6", border: "3px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.15)" })
        new maplibregl.Marker({ element: me }).setLngLat([center.lng, center.lat]).addTo(map)
      }
      setReady(true)
    })()
    return () => { cancelled = true; pinMarkers.clear(); map?.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the camera props only set where the map opens
  }, [center.lat, center.lng, showMe])

  // Pins, synced whenever the list changes (e.g. switching to "be the first").
  useEffect(() => {
    const map = mapRef.current
    const lib = libRef.current
    if (!ready || !map || !lib) return
    for (const m of markers.current.values()) m.marker.remove()
    markers.current.clear()
    for (const pin of pins) {
      const { wrap, button, label } = pinElement(pin)
      button.addEventListener("click", e => {
        e.stopPropagation()
        if (cb.current.onSelect) cb.current.onSelect(pin.id)
        else cb.current.router.push(pin.href)
      })
      const marker = new lib.Marker({ element: wrap, anchor: "center" }).setLngLat([pin.lng, pin.lat]).addTo(map)
      markers.current.set(pin.id, { marker, button, label, reviewed: pin.score != null })
    }
    styleMarkers()
    if (!framed.current && showMe && pins.length > 0) {
      framed.current = true
      // Pins arrive nearest first.
      const bounds = new lib.LngLatBounds([center.lng, center.lat], [center.lng, center.lat])
      for (const p of pins.slice(0, 8)) bounds.extend([p.lng, p.lat])
      map.fitBounds(bounds, { padding: { top: 40, bottom: 110, left: 40, right: 50 }, maxZoom: 16, duration: 0 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, ready])

  // Highlight the selected pin and bring it into view.
  useEffect(() => {
    styleMarkers()
    const map = mapRef.current
    const pin = pins.find(p => p.id === selectedId)
    if (!map || !pin) return
    // Centre it, a little above the middle so the preview card doesn't cover it.
    map.easeTo({ center: [pin.lng, pin.lat], offset: [0, -60], duration: 350 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, ready])

  return <div ref={container} role="region" aria-label="Map of shops near you" style={{ height, borderRadius: 18, overflow: "hidden", background: THEME.background }} />
}
