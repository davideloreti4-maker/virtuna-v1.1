"use client";

import { cn } from "@/lib/utils";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { StaggerReveal } from "@/components/motion";
import { FadeInUp } from "@/components/motion";

const testimonials = [
  {
    quote:
      "Virtuna completely changed how we approach social media research. The trend detection is incredibly accurate.",
    author: {
      name: "Sarah Chen",
      role: "Head of Research",
      company: "MediaLab",
    },
    featured: false,
  },
  {
    quote:
      "We went from spending weeks on audience analysis to getting actionable insights in minutes. Game changer.",
    author: {
      name: "Marcus Rivera",
      role: "VP of Marketing",
      company: "Pulse Digital",
    },
    featured: true,
  },
  {
    quote:
      "The dashboard is beautifully designed and the data visualization makes complex trends easy to understand.",
    author: {
      name: "Aisha Patel",
      role: "Data Scientist",
      company: "InsightFlow",
    },
    featured: false,
  },
];

interface TestimonialsSectionProps {
  className?: string;
}

export function TestimonialsSection({ className }: TestimonialsSectionProps) {
  return (
    <section className={cn("py-20 md:py-24", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <FadeInUp className="mb-12 text-center">
          <h2 className="font-display text-3xl font-[350] text-white md:text-4xl">
            What people are saying
          </h2>
          <p className="mt-4 text-lg text-foreground-secondary">
            Teams trust Virtuna to power their social media intelligence.
          </p>
        </FadeInUp>

        <StaggerReveal className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <StaggerReveal.Item key={t.author.name}>
              <TestimonialCard
                quote={t.quote}
                author={t.author}
                featured={t.featured}
                className="h-full"
              />
            </StaggerReveal.Item>
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}
