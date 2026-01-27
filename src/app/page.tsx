"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Container } from "@/components/layout/container"

export default function LandingPage() {
  return (
    <div className="bg-[#0d0d0d] min-h-screen relative overflow-hidden">
      {/* Orange Corner Decoration - matching societies.io */}
      <OrangeCornerDecoration />

      {/* Dot Grid Background - Full Page */}
      <DotGrid />

      {/* Hero Section - Full Height */}
      <section className="relative min-h-screen flex items-center">
        <Container>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side - Text */}
            <div className="space-y-8 z-10">
              <h1
                className="text-[52px] leading-[1.2] tracking-normal"
                style={{ fontFamily: 'var(--font-funnel-display), sans-serif', fontWeight: 350 }}
              >
                <span className="text-white">Human Behavior,</span>
                <br />
                <span className="text-[#E57850]">Simulated.</span>
              </h1>

              <p
                className="text-[28px] text-[#f5f5f5] max-w-xl leading-[1.4]"
                style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif', fontWeight: 400 }}
              >
                AI personas that replicate real-world attitudes, beliefs, and opinions.
              </p>

              <Link
                href="/contact"
                className="inline-flex items-center justify-center bg-[#E57850] text-white text-[15px] font-medium rounded-[6px] hover:bg-[#d46a45] transition-colors"
                style={{ padding: '14px 28px' }}
              >
                Get in touch
              </Link>
            </div>

            {/* Right Side - Node Sphere */}
            <div className="relative h-[550px] lg:h-[650px]">
              <NodeSphere />
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}

// Orange Corner Decoration - matching societies.io top-left orange dots
function OrangeCornerDecoration() {
  return (
    <div className="absolute top-[60px] left-0 w-[300px] h-[300px] pointer-events-none z-10">
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(229, 120, 80, 0.7) 2px, transparent 2px)`,
          backgroundSize: "14px 14px",
          maskImage: "radial-gradient(ellipse 80% 80% at 0% 0%, black 10%, transparent 60%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 0% 0%, black 10%, transparent 60%)",
        }}
      />
    </div>
  )
}

// Dot Grid Background Pattern - Matching societies.io
function DotGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)`,
        backgroundSize: "20px 20px",
      }}
    />
  )
}

// Node Sphere Visualization - Matching societies.io
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

    const radiusX = Math.min(width, height) * 0.44
    const radiusY = Math.min(width, height) * 0.44

    const nodeCount = 180

    const names = [
      { first: "Marcus", last: "Williams" },
      { first: "Emma", last: "Rodriguez" },
      { first: "James", last: "Chen" },
      { first: "Sarah", last: "Thompson" },
      { first: "Michael", last: "Brown" },
      { first: "Lisa", last: "Anderson" },
      { first: "David", last: "Kim" },
      { first: "Rachel", last: "Garcia" },
    ]
    const roles = [
      "Financial Analyst",
      "UX Researcher",
      "Marketing Manager",
      "Software Engineer",
      "Product Designer",
      "Data Analyst",
      "Operations Director",
      "Sales Manager",
    ]

    if (nodesRef.current.length === 0) {
      nodesRef.current = Array.from({ length: nodeCount }, (_, i) => {
        const phi = Math.acos(1 - 2 * (i + 0.5) / nodeCount)
        const theta = Math.PI * (1 + Math.sqrt(5)) * i

        const x = Math.sin(phi) * Math.cos(theta)
        const y = Math.sin(phi) * Math.sin(theta)
        const z = Math.cos(phi)

        const size = 5 + Math.random() * 8
        const brightness = 160 + Math.floor(Math.random() * 95)
        const color = `rgb(${brightness}, ${brightness}, ${brightness})`

        // Highlighted node in upper-right area of sphere (matching societies.io)
        const isHighlighted = i === 18

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

      // Draw connections - white/gray lines
      ctx.lineWidth = 0.5

      for (let i = 0; i < sortedNodes.length; i++) {
        for (let j = i + 1; j < Math.min(i + 12, sortedNodes.length); j++) {
          const node1 = sortedNodes[i]
          const node2 = sortedNodes[j]
          if (!node1 || !node2) continue

          const x1 = centerX + node1.rotatedX * radiusX
          const y1 = centerY + node1.rotatedY * radiusY
          const x2 = centerX + node2.rotatedX * radiusX
          const y2 = centerY + node2.rotatedY * radiusY

          const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

          if (dist < 100) {
            const avgZ = (node1.rotatedZ + node2.rotatedZ) / 2
            const depthOpacity = 0.3 + (avgZ + 1) * 0.35
            const distOpacity = (1 - dist / 100)
            const opacity = distOpacity * depthOpacity * 0.6
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
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

        const scale = 0.4 + (node.rotatedZ + 1) * 0.35
        const opacity = 0.3 + (node.rotatedZ + 1) * 0.35

        if (node.isHighlighted) {
          // Large outer glow - matching societies.io
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, 60 * scale)
          gradient.addColorStop(0, `rgba(229, 120, 80, 1)`)
          gradient.addColorStop(0.2, `rgba(229, 120, 80, 0.8)`)
          gradient.addColorStop(0.5, `rgba(229, 120, 80, 0.3)`)
          gradient.addColorStop(0.8, `rgba(229, 120, 80, 0.1)`)
          gradient.addColorStop(1, `rgba(229, 120, 80, 0)`)
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(x, y, 60 * scale, 0, Math.PI * 2)
          ctx.fill()

          // Core orange node - solid and bright
          ctx.beginPath()
          ctx.arc(x, y, (node.size + 4) * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(229, 120, 80, 1)`
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

        if (dist < node.size + 10) {
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
          <div className="bg-[#1a1a1a] border border-[#333] rounded-xl p-3 shadow-lg min-w-[180px]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-medium">
                {hoveredNode.persona.initials}
              </div>
              <div>
                <div className="text-white font-medium text-sm">
                  {hoveredNode.persona.name}
                </div>
                <div className="text-[#9CA3AF] text-xs">
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
