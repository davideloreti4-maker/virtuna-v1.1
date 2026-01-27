"use client"

import { Container } from "@/components/layout/container"
import { StaggeredGrid, ScrollReveal } from "@/components/animations"

interface FeatureCardProps {
  title: string
  description: string
  icon: React.ReactNode
}

function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div className="group p-6 md:p-8 rounded-lg bg-[#1a1a1a] border border-[#262626] hover:border-[#333333] transition-all duration-300">
      <div className="mb-4 text-[#E57850]">{icon}</div>
      <h3 className="text-xl font-medium text-white mb-3">{title}</h3>
      <p className="text-[#9CA3AF] leading-relaxed">{description}</p>
    </div>
  )
}

// Feature icons as SVG components
function AudienceIcon() {
  return (
    <svg
      className="w-10 h-10"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  )
}

function SpeedIcon() {
  return (
    <svg
      className="w-10 h-10"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  )
}

function DepthIcon() {
  return (
    <svg
      className="w-10 h-10"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
      />
    </svg>
  )
}

function DiversityIcon() {
  return (
    <svg
      className="w-10 h-10"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

const features = [
  {
    title: "Unreachable audiences",
    description:
      "Survey Fortune 500 executives, rare specialists, or hyper-specific demographics that traditional panels cannot access.",
    icon: <AudienceIcon />,
  },
  {
    title: "Instant insights",
    description:
      "Replace weeks of recruitment and fieldwork with instant responses. Run thousands of interviews before your competitor sends one survey.",
    icon: <SpeedIcon />,
  },
  {
    title: "Millions of personas",
    description:
      "Every persona is demographically and psychographically calibrated, creating responses as nuanced and diverse as real humans.",
    icon: <DiversityIcon />,
  },
  {
    title: "True understanding",
    description:
      "Go beyond surface-level answers. Our personas reason, reflect, and respond with the depth of genuine human cognition.",
    icon: <DepthIcon />,
  },
]

export function Features() {
  return (
    <section className="relative py-20 md:py-32 bg-[#0d0d0d]">
      <Container>
        {/* Section header */}
        <ScrollReveal className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-sm text-[#9CA3AF] uppercase tracking-wider mb-4 block">
            Into the future
          </span>
          <h2
            className="text-white mb-6"
            style={{
              fontFamily: '"Funnel Display", var(--font-display)',
              fontSize: 'clamp(1.75rem, 4vw, 40px)',
              fontWeight: 350,
              lineHeight: 1.2,
            }}
          >
            Research that was impossible<br />is now instant
          </h2>
          <p className="text-lg text-[#9CA3AF]">
            Access high-value audiences. Understand decision-makers. Discover critical insights.
          </p>
        </ScrollReveal>

        {/* Features grid */}
        <StaggeredGrid
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
          staggerDelay={0.1}
        >
          {features.map((feature) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              description={feature.description}
              icon={feature.icon}
            />
          ))}
        </StaggeredGrid>
      </Container>
    </section>
  )
}
