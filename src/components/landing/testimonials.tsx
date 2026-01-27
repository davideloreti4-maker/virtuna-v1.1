"use client"

import Image from "next/image"
import { Container } from "@/components/layout/container"
import { ScrollReveal, FadeIn } from "@/components/animations"

interface TestimonialProps {
  quote: string
  author: string
  title: string
  company: string
  image?: string
}

function TestimonialCard({ quote, author, title, company, image }: TestimonialProps) {
  return (
    <div className="p-8 md:p-10 rounded-lg bg-[#1a1a1a] border border-[#262626]">
      <blockquote className="text-lg md:text-xl text-white leading-relaxed mb-8">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="flex items-center gap-4">
        {image ? (
          <Image
            src={image}
            alt={author}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#262626] flex items-center justify-center text-white font-medium">
            {author.charAt(0)}
          </div>
        )}
        <div>
          <div className="text-white font-medium">{author}</div>
          <div className="text-[#9CA3AF] text-sm">
            {title}, {company}
          </div>
        </div>
      </div>
    </div>
  )
}

const testimonials: TestimonialProps[] = [
  {
    quote:
      "What we were able to accomplish with Artificial Societies would simply have been impossible with traditional market research.",
    author: "Sparky Zivin",
    title: "Global Head of Research",
    company: "Teneo",
    image: "/images/landing/sparky_zivin-B2KuZ-Xx.jpeg",
  },
  {
    quote:
      "By fusing Pulsar's real-world audience intelligence with Artificial Societies' live simulations, we're turning static personas into dynamic conversations.",
    author: "Francesco D'Orazio",
    title: "Chief Executive Officer",
    company: "Pulsar",
  },
]

export function Testimonials() {
  return (
    <section className="relative py-20 md:py-32 bg-[#141414]">
      <Container>
        {/* Section header */}
        <ScrollReveal className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-light text-white mb-6">
            Trusted by industry leaders
          </h2>
          <p className="text-lg text-[#9CA3AF]">
            Powering the future of audience intelligence. Together, we&apos;re redefining what&apos;s possible in understanding human behavior at scale.
          </p>
        </ScrollReveal>

        {/* Testimonials grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <FadeIn key={testimonial.author} delay={index * 0.2} scroll threshold={0.2}>
              <TestimonialCard {...testimonial} />
            </FadeIn>
          ))}
        </div>
      </Container>
    </section>
  )
}
