"use client"

import Image from "next/image"
import Link from "next/link"
import { Container } from "@/components/layout/container"
import { ScrollReveal } from "@/components/animations"

// First testimonial section: Case Study + Sparky Quote (goes BEFORE Accuracy)
export function CaseStudySection() {
  return (
    <section className="relative py-20 md:py-32 bg-[#0d0d0d]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
          {/* Vertical separator line */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-[#262626]" />

          {/* Left - Case Study Card */}
          <ScrollReveal>
            <div className="p-8 rounded-xl bg-[#141414] border border-[#262626] h-full lg:mr-3">
              <span className="text-xs text-[#E57850] uppercase tracking-wider mb-6 block">
                Case Study
              </span>

              {/* Teneo Logo */}
              <div className="mb-6">
                <Image
                  src="/images/landing/teneo-logo-dark-jwgUPXrf.png"
                  alt="Teneo"
                  width={100}
                  height={32}
                  className="h-8 w-auto"
                />
              </div>

              <p className="text-white text-lg mb-6">
                How Teneo used Artificial Societies to simulate 180,000+ human perspectives.
              </p>

              <Link
                href="/case-studies/teneo"
                className="inline-flex items-center gap-2 text-white hover:text-[#E57850] transition-colors text-sm"
              >
                Read more
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </ScrollReveal>

          {/* Right - Quote Card */}
          <ScrollReveal delay={0.1}>
            <div className="p-8 rounded-xl bg-[#141414] border border-[#262626] h-full lg:ml-3">
              {/* Orange quote marks */}
              <div className="text-[#E57850] text-4xl font-serif mb-4">&ldquo;</div>
              <blockquote className="text-white text-lg leading-relaxed mb-6 italic">
                What we were able to accomplish with Artificial Societies would simply have been impossible with traditional market research
              </blockquote>
              <div className="flex items-center gap-3">
                <Image
                  src="/images/landing/sparky_zivin-B2KuZ-Xx.jpeg"
                  alt="Sparky Zivin"
                  width={48}
                  height={48}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <div className="text-white font-medium">Sparky Zivin</div>
                  <div className="text-[#9CA3AF] text-sm">Global Head of Research, Teneo</div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </Container>
    </section>
  )
}

// Second testimonial section: Francesco Quote + Partnership (goes AFTER Accuracy)
export function PartnershipSection() {
  return (
    <section className="relative py-20 md:py-32 bg-[#0d0d0d]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
          {/* Vertical separator line */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-[#262626]" />

          {/* Left - Quote Card */}
          <ScrollReveal>
            <div className="p-8 rounded-xl bg-[#141414] border border-[#262626] h-full lg:mr-3">
              {/* Orange quote marks */}
              <div className="text-[#E57850] text-4xl font-serif mb-4">&ldquo;</div>
              <blockquote className="text-white text-lg leading-relaxed mb-6 italic">
                By fusing Pulsar&apos;s real-world audience intelligence with Artificial Societies&apos; live simulations, we&apos;re turning static personas into dynamic conversations.
              </blockquote>
              <div className="flex items-center gap-3">
                {/* Francesco placeholder */}
                <div className="w-12 h-12 rounded-full bg-[#262626] flex items-center justify-center text-white font-medium">
                  FD
                </div>
                <div>
                  <div className="text-white font-medium">Francesco D&apos;Orazio</div>
                  <div className="text-[#9CA3AF] text-sm">Chief Executive Officer, Pulsar</div>
                </div>
              </div>
            </div>
          </ScrollReveal>

          {/* Right - Partnership Card */}
          <ScrollReveal delay={0.1}>
            <div className="p-8 rounded-xl bg-[#141414] border border-[#262626] h-full lg:ml-3">
              <span className="text-xs text-[#E57850] uppercase tracking-wider mb-6 block">
                Strategic partnership
              </span>

              {/* Pulsar Logo - text placeholder */}
              <div className="mb-6">
                <span className="text-2xl font-semibold text-white tracking-tight">pulsar</span>
              </div>

              <p className="text-[#9CA3AF] text-base leading-relaxed">
                Powering the future of audience intelligence. Together, we&apos;re redefining what&apos;s possible in understanding human behavior at scale.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </Container>
    </section>
  )
}

// Legacy export for backwards compatibility
export function Testimonials() {
  return (
    <>
      <CaseStudySection />
      <PartnershipSection />
    </>
  )
}
