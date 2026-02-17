"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { FadeIn } from "@/components/motion";
import { TestimonialQuote } from "./testimonial-quote";

/**
 * CaseStudySection component featuring the Teneo case study.
 * Two-column layout: left card with details, right quote.
 *
 * Layout matches societies.io reference:
 * - Section: py-24 with max-w-6xl container
 * - Left: Case study card with logo, description, read more link
 * - Right: Testimonial quote from Sparky Zivin
 *
 * Features scroll-triggered fade-in animations.
 */
export function CaseStudySection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Left: Case Study Card */}
          <FadeIn>
            <div className="rounded-lg bg-background-elevated p-8">
              <span className="text-sm text-foreground-muted">Case Study</span>
              <Image
                src="/logos/teneo-logo-dark.png"
                alt="Teneo"
                width={220}
                height={48}
                className="mt-4 h-12 w-auto"
              />
              <p className="mt-6 text-lg text-white">
                How Teneo used Artificial Societies to simulate 180,000+ human
                perspectives.
              </p>
              <Link
                href="/coming-soon"
                className="mt-6 flex items-center gap-2 text-white transition-opacity hover:opacity-80"
              >
                <span>Read more</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </FadeIn>

          {/* Right: Quote */}
          <FadeIn delay={0.15}>
            <TestimonialQuote
              quote="What we were able to accomplish with Artificial Societies would simply have been impossible with traditional market research"
              authorName="Sparky Zivin"
              authorTitle="Global Head of Research"
              authorCompany="Teneo"
            />
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
