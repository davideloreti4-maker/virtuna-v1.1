"use client"

import Image from "next/image"
import { Container } from "@/components/layout/container"
import { FadeIn } from "@/components/animations"

// Partner logos from societies.io
const partnerLogos = [
  {
    name: "Teneo",
    src: "/images/landing/teneo-logo-light-DLRv00GF.png",
    width: 120,
    height: 40,
  },
  {
    name: "DC Advisory",
    src: "/images/landing/DC_light-90-SC48D.png",
    width: 140,
    height: 40,
  },
  {
    name: "GP Strategies",
    src: "/images/landing/GP_light-BOrATME-.png",
    width: 140,
    height: 40,
  },
  {
    name: "TE Connectivity",
    src: "/images/landing/TE_light-CGE9Ti3P.png",
    width: 120,
    height: 40,
  },
]

export function LogosSection() {
  return (
    <section className="relative py-16 md:py-20 bg-[#0d0d0d] border-y border-[#262626]">
      <Container>
        <FadeIn scroll threshold={0.3}>
          <div className="text-center">
            <p className="text-sm text-[#9CA3AF] uppercase tracking-wider mb-10">
              Trusted by industry leaders
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 opacity-70">
              {partnerLogos.map((logo) => (
                <div
                  key={logo.name}
                  className="relative grayscale hover:grayscale-0 transition-all duration-300"
                >
                  <Image
                    src={logo.src}
                    alt={logo.name}
                    width={logo.width}
                    height={logo.height}
                    className="h-8 md:h-10 w-auto object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </Container>
    </section>
  )
}
