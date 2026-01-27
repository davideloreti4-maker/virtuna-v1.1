"use client"

import { useEffect, useRef, useState } from "react"

interface Persona {
  initials: string
  name: string
  role: string
  company: string
  description: string
  tags: { icon: string; label: string }[]
}

interface Node {
  x: number
  y: number
  z: number
  baseX: number
  baseY: number
  baseZ: number
  size: number
  color: string
  isHighlighted: boolean
  persona: Persona
}

export function NetworkVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hoveredNode, setHoveredNode] = useState<{
    x: number
    y: number
    persona: Persona
  } | null>(null)
  const nodesRef = useRef<Node[]>([])
  const rotationRef = useRef(0)

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

    const radiusX = Math.min(width, height) * 0.38
    const radiusY = Math.min(width, height) * 0.34
    const nodeCount = 200  // Dense cluster like societies.io

    const names = [
      { first: "Marcus", last: "Williams" },
      { first: "Emma", last: "Rodriguez" },
      { first: "James", last: "Chen" },
      { first: "Sarah", last: "Thompson" },
      { first: "Michael", last: "Brown" },
      { first: "Lisa", last: "Anderson" },
      { first: "David", last: "Kim" },
      { first: "Sophie", last: "Laurent" },
    ]
    const roles = [
      "Financial Analyst", "Brand Director", "Marketing Manager", "UX Researcher",
      "Product Designer", "Data Scientist", "Content Creator", "Startup Founder",
    ]
    const companies = [
      "Goldman & Partners", "Luxe Collective", "TechVentures Inc", "DesignLab Studio",
      "Digital Innovations", "Market Research Co", "Growth Dynamics", "Innovation Labs",
    ]
    const locations = ["London, UK", "Paris, France", "New York, USA", "Berlin, Germany", "Sydney, Australia"]
    const genders = ["Male", "Female"]
    const generations = ["Gen X", "Millennial", "Gen Z"]
    const attitudes = ["Moderate", "Liberal", "Conservative"]
    const seniorityLevels = ["Manager", "Director", "Senior", "Lead"]
    const industries = ["Finance", "Fashion", "Tech", "Marketing", "Healthcare"]

    if (nodesRef.current.length === 0) {
      nodesRef.current = Array.from({ length: nodeCount }, (_, i) => {
        // Mix of surface and interior nodes for filled appearance
        const isSurface = i < nodeCount * 0.6
        let x, y, z

        if (isSurface) {
          // Fibonacci sphere for surface nodes
          const phi = Math.acos(1 - 2 * (i + 0.5) / (nodeCount * 0.6))
          const theta = Math.PI * (1 + Math.sqrt(5)) * i
          x = Math.sin(phi) * Math.cos(theta)
          y = Math.sin(phi) * Math.sin(theta)
          z = Math.cos(phi)
        } else {
          // Random interior nodes for filled appearance
          const r = Math.pow(Math.random(), 0.5) * 0.85 // Bias toward outer regions
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1)
          x = r * Math.sin(phi) * Math.cos(theta)
          y = r * Math.sin(phi) * Math.sin(theta)
          z = r * Math.cos(phi)
        }

        const size = 3 + Math.random() * 5
        const brightness = 80 + Math.floor(Math.random() * 100)
        const color = `rgb(${brightness}, ${brightness}, ${brightness})`
        const isHighlighted = i === Math.floor(nodeCount * 0.35)

        const nameData = names[Math.floor(Math.random() * names.length)]
        const fullName = `${nameData.first} ${nameData.last}`
        const initials = `${nameData.first[0]}${nameData.last[0]}`

        const persona: Persona = {
          initials,
          name: fullName,
          role: roles[Math.floor(Math.random() * roles.length)],
          company: companies[Math.floor(Math.random() * companies.length)],
          description: "Focused on emerging markets and sustainable investment strategies.",
          tags: [
            { icon: "📍", label: locations[Math.floor(Math.random() * locations.length)] },
            { icon: "👤", label: genders[Math.floor(Math.random() * genders.length)] },
            { icon: "📅", label: generations[Math.floor(Math.random() * generations.length)] },
            { icon: "🎯", label: attitudes[Math.floor(Math.random() * attitudes.length)] },
            { icon: "💼", label: seniorityLevels[Math.floor(Math.random() * seniorityLevels.length)] },
            { icon: "🏢", label: industries[Math.floor(Math.random() * industries.length)] },
          ],
        }

        return { x, y, z, baseX: x, baseY: y, baseZ: z, size, color, isHighlighted, persona }
      })
    }

    let animationId: number

    const animate = () => {
      ctx.clearRect(0, 0, width, height)
      rotationRef.current += 0.002

      const sortedNodes = [...nodesRef.current]
        .map((node) => {
          const cosR = Math.cos(rotationRef.current)
          const sinR = Math.sin(rotationRef.current)
          const rotatedX = node.baseX * cosR - node.baseZ * sinR
          const rotatedZ = node.baseX * sinR + node.baseZ * cosR

          return { ...node, rotatedX, rotatedY: node.baseY, rotatedZ }
        })
        .sort((a, b) => a.rotatedZ - b.rotatedZ)

      // Draw connection lines - more prominent like societies.io
      ctx.lineWidth = 0.6
      for (let i = 0; i < sortedNodes.length; i++) {
        for (let j = i + 1; j < Math.min(i + 12, sortedNodes.length); j++) {
          const node1 = sortedNodes[i]
          const node2 = sortedNodes[j]

          const x1 = centerX + node1.rotatedX * radiusX
          const y1 = centerY + node1.rotatedY * radiusY
          const x2 = centerX + node2.rotatedX * radiusX
          const y2 = centerY + node2.rotatedY * radiusY

          const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)

          if (dist < 90) {
            const opacity = (1 - dist / 90) * 0.45
            ctx.strokeStyle = `rgba(140, 140, 140, ${opacity})`
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
        const opacity = 0.3 + (node.rotatedZ + 1) * 0.35

        if (node.isHighlighted) {
          // Orange highlighted node
          ctx.beginPath()
          ctx.arc(x, y, (node.size + 4) * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(229, 120, 80, ${opacity + 0.3})`
          ctx.fill()

          // Glow
          ctx.beginPath()
          ctx.arc(x, y, (node.size + 8) * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(229, 120, 80, ${opacity * 0.2})`
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

      if (!found) setHoveredNode(null)
    }

    canvas.addEventListener("mousemove", handleMouseMove)

    return () => {
      cancelAnimationFrame(animationId)
      canvas.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  // Default persona to show (matching societies.io style)
  const defaultPersona: Persona = {
    initials: "MW",
    name: "Marcus Williams",
    role: "Financial Analyst",
    company: "Goldman & Partners",
    description: "Focused on emerging markets and sustainable investment strategies.",
    tags: [
      { icon: "📍", label: "London, UK" },
      { icon: "👤", label: "Male" },
      { icon: "📅", label: "Gen X" },
      { icon: "🎯", label: "Moderate" },
      { icon: "💼", label: "Manager" },
      { icon: "🏢", label: "Finance" },
    ],
  }

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Default Persona Card - always visible, positioned to overlap with top of sphere */}
      <div
        className="absolute z-20 pointer-events-none"
        style={{ right: "8%", top: "12%" }}
      >
        <div className="bg-[rgba(20,20,20,0.95)] border border-[rgb(50,50,50)] rounded-xl p-4 backdrop-blur-md min-w-[260px] shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-white text-sm font-medium">
              {defaultPersona.initials}
            </div>
            <div>
              <div className="text-white font-medium text-sm">{defaultPersona.name}</div>
              <div className="text-[rgb(150,150,150)] text-xs">{defaultPersona.role}</div>
            </div>
          </div>

          <div className="text-white text-xs font-medium mb-1">{defaultPersona.company}</div>
          <div className="text-[rgb(100,100,100)] text-xs mb-3">{defaultPersona.description}</div>

          <div className="flex flex-wrap gap-1.5">
            {defaultPersona.tags.map((tag, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs bg-[rgba(255,255,255,0.06)] text-[rgb(150,150,150)] rounded flex items-center gap-1"
              >
                <span className="text-[10px]">{tag.icon}</span>
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hover Persona Card - shows on hover over nodes */}
      {hoveredNode && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: hoveredNode.x + 15, top: hoveredNode.y - 10 }}
        >
          <div className="bg-[rgba(20,20,20,0.95)] border border-[rgb(50,50,50)] rounded-xl p-4 backdrop-blur-md min-w-[260px] shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.1)] flex items-center justify-center text-white text-sm font-medium">
                {hoveredNode.persona.initials}
              </div>
              <div>
                <div className="text-white font-medium text-sm">{hoveredNode.persona.name}</div>
                <div className="text-[rgb(150,150,150)] text-xs">{hoveredNode.persona.role}</div>
              </div>
            </div>

            <div className="text-white text-xs font-medium mb-1">{hoveredNode.persona.company}</div>
            <div className="text-[rgb(100,100,100)] text-xs mb-3">{hoveredNode.persona.description}</div>

            <div className="flex flex-wrap gap-1.5">
              {hoveredNode.persona.tags.map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-1 text-xs bg-[rgba(255,255,255,0.06)] text-[rgb(150,150,150)] rounded flex items-center gap-1"
                >
                  <span className="text-[10px]">{tag.icon}</span>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
