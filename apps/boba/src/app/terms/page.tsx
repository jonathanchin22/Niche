import { LegalPage, Section } from "@/components/legal/LegalPage"

export const metadata = { title: "Terms — boba!" }

export default function TermsPage() {
  return (
    <LegalPage title="terms" updated="September 2026">
      <p>By using Niche apps you agree to these terms.</p>

      <Section heading="your content">
        <p>You own what you post. You give Niche permission to show it in the apps and to people you share it with. Only post photos you took or have the right to share.</p>
      </Section>

      <Section heading="be decent">
        <p>No harassment, hate, spam, fake reviews, or anything illegal or sexual. You can report anything that breaks these rules from the cup or profile. We review reports and may remove content or accounts.</p>
      </Section>

      <Section heading="honest reviews">
        <p>Reviews are personal opinions. Don’t post reviews you were paid for without saying so, and don’t review a place you own or work for.</p>
      </Section>

      <Section heading="the service">
        <p>Niche is provided as is. We may change or stop features, and we can’t promise it will always be available or error-free.</p>
      </Section>

      <Section heading="leaving">
        <p>You can delete your account at any time in settings. We may suspend accounts that break these terms.</p>
      </Section>
    </LegalPage>
  )
}
