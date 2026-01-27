import { Hero } from "@/components/landing/hero"
import { LogosSection } from "@/components/landing/logos-section"
import { Features } from "@/components/landing/features"
import { Testimonials } from "@/components/landing/testimonials"
import { CTASection } from "@/components/landing/cta-section"

export default function HomePage() {
  return (
    <main>
      <Hero />
      <LogosSection />
      <Features />
      <Testimonials />
      <CTASection />
    </main>
  )
}
