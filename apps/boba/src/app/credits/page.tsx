import { LegalPage, Section } from "@/components/legal/LegalPage"

export const metadata = { title: "Map & place data — boba!" }

/** Attribution the map and place data licences ask for (the map itself shows a small ⓘ). */
export default function CreditsPage() {
  return (
    <LegalPage title="map & place data" updated="October 2026">
      <p>Maps and places in Niche come from open data. Thank you to everyone who makes it.</p>

      <Section heading="maps">
        <p>Map tiles by <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>, built on <a href="https://openmaptiles.org" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a>. Map data <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>.</p>
      </Section>

      <Section heading="places">
        <p>Place data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> (ODbL) and <a href="https://overturemaps.org" target="_blank" rel="noopener noreferrer">Overture Maps Foundation</a> (CDLA-Permissive-2.0, ODbL). Addresses are looked up with <a href="https://nominatim.org" target="_blank" rel="noopener noreferrer">Nominatim</a>.</p>
        <p>Spot something wrong or missing? Add it while logging, or pin it from its page.</p>
      </Section>
    </LegalPage>
  )
}
