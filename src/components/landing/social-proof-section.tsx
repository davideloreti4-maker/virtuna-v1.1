"use client";

import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion";
import { TestimonialQuote } from "./testimonial-quote";

const testimonials = [
  {
    quote:
      "Virtuna told me my dance video would flop — and it was right. I pivoted to a storytelling format and got 2M views instead.",
    authorName: "Maya Chen",
    authorTitle: "500K followers",
    authorCompany: "TikTok",
  },
  {
    quote:
      "The trend intelligence is a game-changer. I went from posting randomly to catching every wave early. My views tripled in two months.",
    authorName: "Jordan Williams",
    authorTitle: "1.2M followers",
    authorCompany: "TikTok",
  },
  {
    quote:
      "The AI prediction is scarily accurate. It's like having a focus group of thousands test your content before you post.",
    authorName: "Priya Sharma",
    authorTitle: "340K followers",
    authorCompany: "TikTok",
  },
];

interface SocialProofSectionProps {
  className?: string;
}

export function SocialProofSection({ className }: SocialProofSectionProps) {
  return (
    <section className={cn("py-24", className)}>
      <div className="mx-auto max-w-6xl px-6">
        <FadeIn>
          <div className="mb-16 text-center">
            <span className="text-sm text-foreground-secondary">
              Creator stories
            </span>
            <h2 className="mt-4 text-[32px] font-normal leading-[36px] text-white sm:text-[40px] sm:leading-[44px]">
              Trusted by creators who
              <br />
              take growth seriously
            </h2>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <FadeIn key={testimonial.authorName} delay={0.1 + index * 0.15}>
              <div
                className="rounded-[12px] border border-white/[0.06] p-8 h-full"
                style={{
                  boxShadow:
                    "rgba(255, 255, 255, 0.05) 0px 1px 0px 0px inset",
                }}
              >
                <TestimonialQuote
                  quote={testimonial.quote}
                  authorName={testimonial.authorName}
                  authorTitle={testimonial.authorTitle}
                  authorCompany={testimonial.authorCompany}
                />
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
