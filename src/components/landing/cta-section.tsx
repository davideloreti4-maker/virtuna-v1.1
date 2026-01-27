"use client"

import Link from "next/link"
import { Container } from "@/components/layout/container"
import { ScrollReveal } from "@/components/animations"

export function CTASection() {
  return (
    <section className="relative py-16 md:py-24 bg-[#0d0d0d]">
      <Container>
        <ScrollReveal>
          <div className="relative p-12 md:p-16 rounded-3xl bg-[#141414] border border-[#262626] text-center overflow-hidden">
            {/* Orange glow effect at top */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] rounded-full blur-[100px]"
              style={{ background: 'rgba(229, 120, 80, 0.15)' }}
            />

            <div className="relative z-10">
              <h2
                className="text-white mb-6"
                style={{
                  fontFamily: '"Funnel Display", var(--font-display)',
                  fontSize: 'clamp(1.75rem, 4vw, 40px)',
                  fontWeight: 350,
                  lineHeight: 1.2,
                }}
              >
                Ready to understand your audience?
              </h2>
              <p className="text-base text-[#9CA3AF] max-w-xl mx-auto mb-10">
                Join the world&apos;s leading organizations using AI to unlock human insights at scale.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center bg-[#E57850] text-white font-medium text-sm rounded-md hover:bg-[#d46a45] transition-colors px-6 py-3"
                >
                  Book a meeting
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center bg-transparent border border-[#333333] text-white font-medium text-sm rounded-md hover:bg-white/5 transition-colors px-6 py-3"
                >
                  Contact us
                </Link>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </Container>
    </section>
  )
}
