"use client";

import Image from "next/image";
import { FadeIn } from "@/components/motion";
import { TestimonialQuote } from "./testimonial-quote";

/**
 * PartnershipSection component featuring Pulsar strategic partnership.
 * Mirrored two-column layout: left quote, right card.
 *
 * Layout matches societies.io reference:
 * - Section: py-24 with max-w-6xl container
 * - Left: Testimonial quote from Francesco D'Orazio
 * - Right: Partnership card with logo and description
 *
 * Features scroll-triggered fade-in animations.
 */
export function PartnershipSection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Left: Quote */}
          <FadeIn>
            <TestimonialQuote
              quote="By fusing Pulsar's real-world audience intelligence with Artificial Societies' live simulations, we're turning static personas into dynamic conversations."
              authorName="Francesco D'Orazio"
              authorTitle="Chief Executive Officer"
              authorCompany="Pulsar"
            />
          </FadeIn>

          {/* Right: Partnership Card */}
          <FadeIn delay={0.15}>
            <div className="rounded-lg bg-background-elevated p-8">
              <span className="text-sm text-foreground-muted">
                Strategic partnership
              </span>
              <Image
                src="/logos/pulsar.svg"
                alt="Pulsar"
                width={160}
                height={40}
                className="mt-4 h-10 w-auto"
              />
              <p className="mt-6 text-lg text-white">
                Powering the future of audience intelligence. Together, we&apos;re
                redefining what&apos;s possible in understanding human behavior at
                scale.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
