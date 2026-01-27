import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { Testimonials } from "@/components/landing/testimonials"
import { AccuracySection } from "@/components/landing/accuracy-section"
import { FAQSection } from "@/components/landing/faq-section"
import { CTASection } from "@/components/landing/cta-section"

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Features />
      <Testimonials />
      <AccuracySection />
      <FAQSection />
      <CTASection />
    </main>
  )
}
