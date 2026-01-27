"use client"

import Link from "next/link"
import { Container } from "@/components/layout/container"
import { FadeIn, SlideUp } from "@/components/animations"
import { NetworkVisualization } from "./network-visualization"

export function Hero() {
  return (
    <section className="relative min-h-screen bg-[#0d0d0d] pt-[66px] overflow-hidden">
      {/* Dot grid background pattern */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(120,120,120,0.4) 1px, transparent 1px)`,
          backgroundSize: '20px 20px',
        }}
      />

      <Container className="relative z-10">
        <div className="flex items-center min-h-[calc(100vh-66px-160px)] py-12 md:py-16">
          {/* 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center w-full">
            {/* Left Side - Text */}
            <div className="space-y-6">
              <SlideUp delay={0}>
                <h1
                  className="text-white"
                  style={{
                    fontFamily: '"Funnel Display", var(--font-display)',
                    fontSize: 'clamp(2rem, 5vw, 52px)',
                    fontWeight: 350,
                    lineHeight: 1.2,
                    letterSpacing: 'normal'
                  }}
                >
                  <span className="block">Human Behavior,</span>
                  <span className="block text-[#E57850]">Simulated.</span>
                </h1>
              </SlideUp>

              {/* Subheadline */}
              <FadeIn delay={0.3}>
                <p className="text-lg md:text-xl text-[#9CA3AF] max-w-md leading-relaxed">
                  AI personas that replicate real-world attitudes, beliefs, and opinions.
                </p>
              </FadeIn>

              {/* Single CTA Button */}
              <FadeIn delay={0.5}>
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center bg-[#E57850] text-white font-medium rounded-[6px] hover:bg-[#d46a45]"
                  style={{
                    fontSize: '15px',
                    padding: '14px 28px',
                    transition: 'background 0.2s'
                  }}
                >
                  Get in touch
                </Link>
              </FadeIn>
            </div>

            {/* Right Side - Network Visualization */}
            <div className="relative h-[500px] lg:h-[580px] flex items-center justify-center">
              <div className="relative w-full h-full pb-16">
                <NetworkVisualization />
              </div>
            </div>
          </div>
        </div>
      </Container>

      {/* Backed By Section - matching societies.io */}
      <div className="absolute bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-[#0a0a0a]">
        <Container>
          <div className="py-5">
            {/* Backed by row */}
            <p className="text-center text-xs text-[rgb(120,120,120)] mb-3">Backed by</p>
            <div className="flex items-center justify-center mb-4">
              {/* Point72 Ventures */}
              <div className="flex items-center gap-2 text-[rgb(150,150,150)] px-6 md:px-8">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="6" width="4" height="12" />
                  <path d="M12 6h4v4h-4z M16 10h4v8h-4z M12 14h4v4h-4z" />
                </svg>
                <span className="text-sm font-medium">Point72 Ventures</span>
              </div>

              {/* Separator */}
              <div className="h-6 w-px bg-[#262626]" />

              {/* Kindred Capital */}
              <div className="flex items-center gap-2 text-[rgb(150,150,150)] px-6 md:px-8">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4v16 M12 4l-8 8 8 8" />
                </svg>
                <span className="text-sm font-medium">Kindred Capital</span>
              </div>

              {/* Separator */}
              <div className="h-6 w-px bg-[#262626]" />

              {/* Y Combinator */}
              <div className="flex items-center gap-2 text-[rgb(150,150,150)] px-6 md:px-8">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14L6 4h3l3 6 3-6h3l-6 10v6h-2v-6z" />
                </svg>
                <span className="text-sm font-medium">Combinator</span>
              </div>
            </div>

            {/* With Investors from row */}
            <p className="text-center text-xs text-[rgb(120,120,120)] mb-3">With Investors from</p>
            <div className="flex items-center justify-center flex-wrap">
              {/* Sequoia */}
              <div className="flex items-center gap-1.5 text-[rgb(130,130,130)] px-4 md:px-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L4 6v12l8 4 8-4V6l-8-4zm0 2.5l5 2.5v7l-5 2.5-5-2.5v-7l5-2.5z" />
                </svg>
                <span className="text-xs font-medium">Sequoia</span>
              </div>

              {/* Separator */}
              <div className="h-5 w-px bg-[#262626] hidden md:block" />

              {/* Google */}
              <div className="flex items-center gap-1.5 text-[rgb(130,130,130)] px-4 md:px-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 11v2.4h3.97c-.16 1.03-1.2 3.02-3.97 3.02-2.39 0-4.34-1.98-4.34-4.42s1.95-4.42 4.34-4.42c1.36 0 2.27.58 2.79 1.08l1.9-1.83C15.47 5.69 13.89 5 12 5 8.13 5 5 8.13 5 12s3.13 7 7 7c4.04 0 6.72-2.84 6.72-6.84 0-.46-.05-.81-.11-1.16H12z" />
                </svg>
                <span className="text-xs font-medium">Google</span>
              </div>

              {/* Separator */}
              <div className="h-5 w-px bg-[#262626] hidden md:block" />

              {/* DeepMind */}
              <div className="flex items-center gap-1.5 text-[rgb(130,130,130)] px-4 md:px-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="3" />
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="12" cy="19" r="2" />
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
                <span className="text-xs font-medium">DeepMind</span>
              </div>

              {/* Separator */}
              <div className="h-5 w-px bg-[#262626] hidden md:block" />

              {/* Prolific */}
              <div className="flex items-center gap-1.5 text-[rgb(130,130,130)] px-4 md:px-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span className="text-xs font-medium">Prolific</span>
              </div>

              {/* Separator */}
              <div className="h-5 w-px bg-[#262626] hidden md:block" />

              {/* Strava */}
              <div className="flex items-center gap-1.5 text-[rgb(130,130,130)] px-4 md:px-6">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                </svg>
                <span className="text-xs font-medium">Strava</span>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </section>
  )
}
