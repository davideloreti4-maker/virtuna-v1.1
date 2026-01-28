"use client";

import Image from "next/image";
import { Button } from "@/components/ui";
import { FadeIn } from "@/components/motion";
import { PersonaCard } from "./persona-card";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  className?: string;
}

const demoPersona = {
  initials: "AP",
  name: "Aisha Patel",
  role: "Data Scientist",
  company: "AI Dynamics",
  bio: "Building machine learning models that transform how businesses understand their customers.",
  location: "Toronto, Canada",
  gender: "Female" as const,
  generation: "Millennial",
};

export function HeroSection({ className }: HeroSectionProps) {
  return (
    <section
      className={cn(
        "relative min-h-[calc(100vh-64px)] flex items-center",
        className
      )}
    >
      {/* Background grid pattern (optional visual enhancement) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:24px_24px]" />

      <div className="relative max-w-6xl mx-auto px-6 py-24 w-full">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
          {/* Left: Text content */}
          <div className="max-w-xl text-center lg:text-left order-2 lg:order-1">
            <FadeIn delay={0}>
              <h1 className="font-display text-[40px] sm:text-[52px] leading-[1.2] font-[350] text-white">
                Human Behavior,
                <br />
                <span className="text-accent">Simulated.</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.1}>
              <p className="font-sans text-lg sm:text-xl leading-[30px] font-[450] text-white/90 mt-6">
                AI personas that replicate real-world attitudes, beliefs, and
                opinions.
              </p>
            </FadeIn>

            <FadeIn delay={0.2}>
              <Button className="mt-8" size="md">
                Get in touch
              </Button>
            </FadeIn>
          </div>

          {/* Right: Network visualization + Persona card */}
          <div className="relative order-1 lg:order-2">
            <FadeIn delay={0.3}>
              <div className="relative w-[300px] sm:w-[450px] lg:w-[500px] xl:w-[626px] aspect-[626/550]">
                {/* Network visualization */}
                <Image
                  src="/images/network-visualization.svg"
                  alt="AI persona network visualization"
                  fill
                  className="object-contain"
                  priority
                />

                {/* Floating persona card */}
                <div className="absolute -bottom-4 -right-4 sm:bottom-0 sm:right-0 lg:-bottom-8 lg:-right-12">
                  <FadeIn delay={0.5}>
                    <PersonaCard
                      {...demoPersona}
                      className="scale-[0.85] sm:scale-90 lg:scale-100 origin-bottom-right shadow-xl"
                    />
                  </FadeIn>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}
