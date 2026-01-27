"use client"

import Link from "next/link"
import { Container } from "@/components/layout/container"
import { FadeIn, SlideUp } from "@/components/animations"

export function Hero() {
  return (
    <section className="relative min-h-screen bg-[#0d0d0d] pt-[60px] overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0d] via-[#0d0d0d] to-[#141414]" />

      <Container className="relative z-10">
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] py-16 md:py-24">
          {/* Main headline */}
          <div className="text-center max-w-4xl mx-auto">
            <SlideUp delay={0}>
              <h1 className="font-display text-[clamp(2.5rem,8vw,5rem)] font-light leading-[1.1] tracking-tight text-white">
                <span className="block">Research that was</span>
                <span className="block text-[#E57850]">impossible</span>
                <span className="block">is now instant.</span>
              </h1>
            </SlideUp>

            {/* Subheadline */}
            <FadeIn delay={0.3}>
              <p className="mt-6 md:mt-8 text-lg md:text-xl text-[#9CA3AF] max-w-2xl mx-auto leading-relaxed">
                Access high-value audiences. Understand decision-makers. Discover critical insights.
              </p>
            </FadeIn>

            {/* CTA Buttons */}
            <FadeIn delay={0.5}>
              <div className="mt-8 md:mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center bg-[#E57850] text-white font-medium text-base rounded-[4px] hover:bg-[#d46a45] transition-colors px-6 py-3 min-w-[160px]"
                >
                  Get in touch
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center bg-transparent border border-[#333333] text-white font-medium text-base rounded-[4px] hover:bg-white/5 transition-colors px-6 py-3 min-w-[160px]"
                >
                  Sign in
                </Link>
              </div>
            </FadeIn>
          </div>

          {/* Hero visual - can be added if societies.io has a hero image */}
          {/* The site appears to use an animated graph/network visualization */}
        </div>
      </Container>

      {/* Bottom fade for transition to next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#141414] to-transparent" />
    </section>
  )
}
