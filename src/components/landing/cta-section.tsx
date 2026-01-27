"use client"

import Link from "next/link"
import { Container } from "@/components/layout/container"
import { ScrollReveal } from "@/components/animations"

export function CTASection() {
  return (
    <section className="relative py-20 md:py-32 bg-[#0d0d0d]">
      <Container>
        <ScrollReveal>
          <div className="relative p-10 md:p-16 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-[#262626] text-center overflow-hidden">
            {/* Background glow effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#E57850]/10 rounded-full blur-3xl" />

            <div className="relative z-10">
              <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-light text-white mb-6">
                Ready to understand your audience?
              </h2>
              <p className="text-lg text-[#9CA3AF] max-w-2xl mx-auto mb-10">
                Join leading organizations using Artificial Societies to unlock insights that were previously impossible to reach.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center bg-[#E57850] text-white font-medium text-base rounded-[4px] hover:bg-[#d46a45] transition-colors px-8 py-4 min-w-[200px]"
                >
                  Book a Meeting
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center bg-transparent border border-[#333333] text-white font-medium text-base rounded-[4px] hover:bg-white/5 transition-colors px-8 py-4 min-w-[200px]"
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
