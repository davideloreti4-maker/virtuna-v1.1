"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/layout/container"
import { FadeIn } from "@/components/animations/fade-in"
import { SlideUp } from "@/components/animations/slide-up"

export default function LandingPage() {
  return (
    <div className="bg-white">

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Dot Grid Background */}
        <DotGrid />

        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text */}
            <SlideUp>
              <div className="space-y-6">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.1] tracking-tight">
                  <span className="text-gray-400">Human Behavior,</span>
                  <br />
                  <span className="text-primary-500">Simulated.</span>
                </h1>

                <p className="text-lg text-gray-500 max-w-md leading-relaxed">
                  AI personas that replicate real-world attitudes, beliefs, and opinions.
                </p>

                <Button variant="primary" size="lg" rounded="default" asChild>
                  <Link href="/contact">Get in touch</Link>
                </Button>
              </div>
            </SlideUp>

            {/* Right Side - Node Sphere */}
            <FadeIn delay={0.2}>
              <div className="relative h-[400px] lg:h-[500px]">
                <NodeSphere />
              </div>
            </FadeIn>
          </div>
        </Container>

        {/* Backed By Section */}
        <BackedBySection />
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50">
        <Container>
          <FadeIn>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
                How it works
              </h2>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto">
                Test your content with AI-powered audience simulations before you publish.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FadeIn key={feature.title} delay={0.1 * (index + 1)}>
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-6">
                    <span className="text-primary-500 text-xl">{feature.icon}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-500 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </Container>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <Container>
          <FadeIn>
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
                Ready to get started?
              </h2>
              <p className="text-lg text-gray-500 mb-8 max-w-2xl mx-auto">
                Join leading brands using AI-powered audience simulation to optimize their content.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="primary" size="lg" asChild>
                  <Link href="/contact">Book a demo</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/pricing">View pricing</Link>
                </Button>
              </div>
            </div>
          </FadeIn>
        </Container>
      </section>
    </div>
  )
}

const features = [
  {
    icon: "🎯",
    title: "Create Your Society",
    description:
      "Define your target audience using demographic and psychographic attributes. Build AI personas that mirror your real customers.",
  },
  {
    icon: "✍️",
    title: "Test Your Content",
    description:
      "Upload your content - posts, ads, emails, or landing pages. Our AI personas analyze and provide feedback before you publish.",
  },
  {
    icon: "📊",
    title: "Optimize & Launch",
    description:
      "Get actionable insights on how to improve engagement. Iterate quickly and launch with confidence.",
  },
]

// Dot Grid Background Pattern
function DotGrid() {
  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        backgroundImage: `radial-gradient(circle, rgba(156,163,175,0.4) 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      }}
    />
  )
}

// Node Sphere Visualization
function NodeSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredNode, setHoveredNode] = useState<{
    x: number
    y: number
    persona: {
      initials: string
      name: string
      role: string
    }
  } | null>(null)

  const nodesRef = useRef<
    {
      x: number
      y: number
      z: number
      baseX: number
      baseY: number
      baseZ: number
      size: number
      color: string
      isHighlighted: boolean
      persona: {
        initials: string
        name: string
        role: string
      }
    }[]
  >([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * 2
      canvas.height = rect.height * 2
      ctx.scale(2, 2)
    }
    updateSize()

    const width = canvas.width / 2
    const height = canvas.height / 2
    const centerX = width / 2
    const centerY = height / 2

    const radiusX = Math.min(width, height) * 0.42
    const radiusY = Math.min(width, height) * 0.38

    const nodeCount = 150

    const names = [
      { first: "Marcus", last: "Williams" },
      { first: "Emma", last: "Rodriguez" },
      { first: "James", last: "Chen" },
      { first: "Sarah", last: "Thompson" },
      { first: "Michael", last: "Brown" },
      { first: "Lisa", last: "Anderson" },
    ]
    const roles = [
      "Financial Analyst",
      "UX Researcher",
      "Marketing Manager",
      "Software Engineer",
      "Product Designer",
      "Data Analyst",
    ]

    if (nodesRef.current.length === 0) {
      nodesRef.current = Array.from({ length: nodeCount }, (_, i) => {
        const phi = Math.acos(1 - 2 * (i + 0.5) / nodeCount)
        const theta = Math.PI * (1 + Math.sqrt(5)) * i

        const x = Math.sin(phi) * Math.cos(theta)
        const y = Math.sin(phi) * Math.sin(theta)
        const z = Math.cos(phi)

        const size = 4 + Math.random() * 6
        const brightness = 140 + Math.floor(Math.random() * 80)
        const color = `rgb(${brightness}, ${brightness}, ${brightness})`
        const isHighlighted = i === Math.floor(nodeCount * 0.45)

        const nameData = names[Math.floor(Math.random() * names.length)] ?? { first: "John", last: "Doe" }
        const fullName = `${nameData.first} ${nameData.last}`
        const initials = `${nameData.first[0]}${nameData.last[0]}`

        const role = roles[Math.floor(Math.random() * roles.length)] ?? "Analyst"

        return {
          x, y, z,
          baseX: x, baseY: y, baseZ: z,
          size, color, isHighlighted,
          persona: {
            initials,
            name: fullName,
            role,
          },
        }
      })
    }

    let animationId: number
    let rotation = 0
    const rotationRef = { current: 0 }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      rotation += 0.002
      rotationRef.current = rotation

      const sortedNodes = [...nodesRef.current]
        .map((node) => {
          const cosR = Math.cos(rotation)
          const sinR = Math.sin(rotation)
          const rotatedX = node.baseX * cosR - node.baseZ * sinR
          const rotatedZ = node.baseX * sinR + node.baseZ * cosR

          return {
            ...node,
            rotatedX,
            rotatedY: node.baseY,
            rotatedZ,
          }
        })
        .sort((a, b) => a.rotatedZ - b.rotatedZ)

      // Draw connections
      ctx.strokeStyle = "rgba(156, 163, 175, 0.2)"
      ctx.lineWidth = 0.5

      for (let i = 0; i < sortedNodes.length; i++) {
        for (let j = i + 1; j < Math.min(i + 6, sortedNodes.length); j++) {
          const node1 = sortedNodes[i]
          const node2 = sortedNodes[j]
          if (!node1 || !node2) continue

          const x1 = centerX + node1.rotatedX * radiusX
          const y1 = centerY + node1.rotatedY * radiusY
          const x2 = centerX + node2.rotatedX * radiusX
          const y2 = centerY + node2.rotatedY * radiusY

          const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

          if (dist < 60) {
            const opacity = (1 - dist / 60) * 0.25
            ctx.strokeStyle = `rgba(156, 163, 175, ${opacity})`
            ctx.beginPath()
            ctx.moveTo(x1, y1)
            ctx.lineTo(x2, y2)
            ctx.stroke()
          }
        }
      }

      // Draw nodes
      sortedNodes.forEach((node) => {
        const x = centerX + node.rotatedX * radiusX
        const y = centerY + node.rotatedY * radiusY

        const scale = 0.5 + (node.rotatedZ + 1) * 0.3
        const opacity = 0.4 + (node.rotatedZ + 1) * 0.3

        if (node.isHighlighted) {
          // Highlighted node (coral/orange)
          ctx.beginPath()
          ctx.arc(x, y, (node.size + 2) * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(249, 115, 22, ${opacity + 0.2})`
          ctx.fill()

          // Glow
          ctx.beginPath()
          ctx.arc(x, y, (node.size + 5) * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(249, 115, 22, ${opacity * 0.2})`
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(x, y, node.size * scale, 0, Math.PI * 2)
          ctx.fillStyle = node.color.replace("rgb", "rgba").replace(")", `, ${opacity})`)
          ctx.fill()
        }
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      let found = false
      for (const node of nodesRef.current) {
        const cosR = Math.cos(rotationRef.current)
        const sinR = Math.sin(rotationRef.current)
        const rotatedX = node.baseX * cosR - node.baseZ * sinR

        const x = centerX + rotatedX * radiusX
        const y = centerY + node.baseY * radiusY
        const dist = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2)

        if (dist < node.size + 8) {
          setHoveredNode({ x: e.clientX, y: e.clientY, persona: node.persona })
          found = true
          break
        }
      }

      if (!found) {
        setHoveredNode(null)
      }
    }

    canvas.addEventListener("mousemove", handleMouseMove)

    return () => {
      cancelAnimationFrame(animationId)
      canvas.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />

      {hoveredNode && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: hoveredNode.x + 15,
            top: hoveredNode.y - 10,
          }}
        >
          <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg min-w-[180px]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-medium">
                {hoveredNode.persona.initials}
              </div>
              <div>
                <div className="text-gray-900 font-medium text-sm">
                  {hoveredNode.persona.name}
                </div>
                <div className="text-gray-500 text-xs">
                  {hoveredNode.persona.role}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Backed By Section
function BackedBySection() {
  return (
    <div className="absolute bottom-0 left-0 right-0 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
      <Container>
        <div className="py-6">
          <p className="text-center text-xs text-gray-400 mb-4">Backed by</p>
          <div className="flex items-center justify-center gap-12 md:gap-16">
            <div className="flex items-center gap-2 text-gray-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="6" width="4" height="12" />
                <path d="M12 6h4v4h-4z M16 10h4v8h-4z M12 14h4v4h-4z" />
              </svg>
              <span className="text-sm font-medium">Point72 Ventures</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4v16 M12 4l-8 8 8 8" />
              </svg>
              <span className="text-sm font-medium">Kindred Capital</span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-gray-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14L6 4h3l3 6 3-6h3l-6 10v6h-2v-6z" />
              </svg>
              <span className="text-sm font-medium">Y Combinator</span>
            </div>
          </div>
        </div>
      </Container>
    </div>
  )
}
