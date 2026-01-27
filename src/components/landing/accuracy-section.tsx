"use client"

import { Container } from "@/components/layout/container"
import { ScrollReveal } from "@/components/animations"

interface AccuracyBarProps {
  name: string
  percentage: number
  icon: React.ReactNode
  isHighlighted?: boolean
}

function AccuracyBar({ name, percentage, icon, isHighlighted }: AccuracyBarProps) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="flex items-center gap-2 w-[180px] shrink-0">
        <div className="w-6 h-6 flex items-center justify-center text-[#9CA3AF]">
          {icon}
        </div>
        <span className="text-sm text-white">{name}</span>
      </div>
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1 h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              isHighlighted ? "bg-[#E57850]" : "bg-[#4a4a4a]"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={`text-sm font-medium w-12 text-right ${isHighlighted ? "text-[#E57850]" : "text-white"}`}>
          {percentage}%
        </span>
      </div>
    </div>
  )
}

// Simple icon components
function ASIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4L4 20h3.5l4.5-10 4.5 10H20L12 4z" />
    </svg>
  )
}

function GeminiIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  )
}

function GPTIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  )
}

const accuracyData = [
  { name: "Artificial Societies", percentage: 86, icon: <ASIcon />, isHighlighted: true },
  { name: "Gemini 2.5 Pro", percentage: 67, icon: <GeminiIcon /> },
  { name: "Gemini 2.5 Flash", percentage: 64, icon: <GeminiIcon /> },
  { name: "GPT-5", percentage: 62, icon: <GPTIcon /> },
  { name: "Gemini 2.0 Flash", percentage: 61, icon: <GeminiIcon /> },
]

export function AccuracySection() {
  return (
    <section className="relative py-20 md:py-32 bg-[#0d0d0d]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left side - Text */}
          <ScrollReveal>
            <div>
              <span className="text-sm text-[#9CA3AF] uppercase tracking-wider mb-4 block">
                Validated accuracy
              </span>
              <h2
                className="text-[#E57850] mb-6"
                style={{
                  fontFamily: '"Funnel Display", var(--font-display)',
                  fontSize: 'clamp(3rem, 8vw, 96px)',
                  fontWeight: 350,
                  lineHeight: 1,
                }}
              >
                86%
              </h2>
              <p className="text-[#9CA3AF] text-lg leading-relaxed mb-6">
                Standard AI personas plateau at 61–67% accuracy. Artificial Societies achieves 86%.
                That's 5 points off the human replication ceiling. Our personas don't just answer
                questions, they give reasons like real people.
              </p>
              <a
                href="https://storage.googleapis.com/as-website-assets/Artificial%20Societies%20Survey%20Eval%20Report%20Jan26.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white hover:text-[#E57850] transition-colors inline-flex items-center gap-1"
              >
                Read the full evaluation report →
              </a>
            </div>
          </ScrollReveal>

          {/* Right side - Chart */}
          <ScrollReveal delay={0.2}>
            <div className="bg-[#141414] rounded-xl p-6 border border-[#262626]">
              <div className="space-y-1">
                {accuracyData.map((item) => (
                  <AccuracyBar
                    key={item.name}
                    name={item.name}
                    percentage={item.percentage}
                    icon={item.icon}
                    isHighlighted={item.isHighlighted}
                  />
                ))}
              </div>
              <p className="text-xs text-[#6b6b6b] mt-4 text-center">
                Proportional allocation accuracy across 1,000 survey replications
              </p>
            </div>
          </ScrollReveal>
        </div>
      </Container>
    </section>
  )
}
