import { LegalPage, Section } from "@/components/legal/LegalPage"

export const metadata = { title: "Privacy — boba!" }

export default function PrivacyPage() {
  return (
    <LegalPage title="privacy" updated="September 2026">
      <p>Niche runs a family of apps (brew, boba and more) that share one account. This page explains what we collect and why, in plain words.</p>

      <Section heading="what we collect">
        <p><strong>Account:</strong> your email address and sign-in details, kept private by our authentication provider and never shown to other people.</p>
        <p><strong>Profile:</strong> username, display name, photo, bio and location if you add them. These are public.</p>
        <p><strong>What you log:</strong> drinks, scores, notes, tags, photos and the café you pick, plus cheers, comments, saves and follows. These are public to other Niche users.</p>
        <p><strong>Location:</strong> only when you open the log screen and allow it, to suggest cafés near you. Your position isn’t stored; only the café you choose is.</p>
        <p><strong>Usage and crash data:</strong> which screens you use and errors the app hits, so we can fix and improve it. This isn’t sold or used for ads.</p>
      </Section>

      <Section heading="who we share it with">
        <p>Service providers that run Niche for us: hosting and database (Supabase), web hosting (Vercel), place search (OpenStreetMap), and analytics and crash reporting when enabled. We don’t sell your data.</p>
      </Section>

      <Section heading="your choices">
        <p>Edit or delete any cup at any time. Block people so they can’t see your cups or follow you. Delete your whole account in settings → delete account; that removes your profile, cups, photos, comments and follows from every Niche app.</p>
      </Section>

      <Section heading="kids">
        <p>Niche isn’t for children under 13, and we don’t knowingly collect their data.</p>
      </Section>
    </LegalPage>
  )
}
