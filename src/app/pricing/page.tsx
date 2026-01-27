"use client"

import Link from "next/link"
import { Container } from "@/components/layout/container"
import { PricingTable, PricingFAQ } from "@/components/landing"
import { ScrollReveal } from "@/components/animations"
import { pricingPageContent } from "@/lib/constants/pricing"

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#0d0d0d] pt-[60px]">
      {/* Hero Section */}
      <section className="py-16 md:py-24 lg:py-32">
        <Container>
          <ScrollReveal>
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
                {pricingPageContent.headline}
              </h1>
              <p className="text-lg md:text-xl text-[#9CA3AF]">
                {pricingPageContent.subheadline}
              </p>
            </div>
          </ScrollReveal>
        </Container>
      </section>

      {/* Pricing Tiers */}
      <section className="py-12 md:py-16">
        <Container>
          <PricingTable />
        </Container>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24 border-t border-[#262626]">
        <Container>
          <PricingFAQ />
        </Container>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-[#141414]">
        <Container>
          <ScrollReveal>
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {pricingPageContent.ctaSection.headline}
              </h2>
              <p className="text-lg text-[#9CA3AF] mb-8">
                {pricingPageContent.ctaSection.subheadline}
              </p>
              <Link
                href={pricingPageContent.ctaSection.ctaHref}
                className="inline-flex items-center justify-center bg-[#E57850] text-white font-medium text-base rounded-lg hover:bg-[#d46a45] transition-colors px-8 py-3"
              >
                {pricingPageContent.ctaSection.ctaText}
              </Link>
            </div>
          </ScrollReveal>
        </Container>
      </section>
    </main>
  )
}
